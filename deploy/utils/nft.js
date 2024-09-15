const { encodeNamed } = require("./keyless");

async function create_nft_collection(api, appAgentOwner, appAgentId, metadataUrl) {
    console.log("Start to create NFT Collection for the AppAgent ID " + appAgentId);

    let asset_admin = encodeNamed(appAgentId, "asset-admi");

    console.log("Send some balance to admin");
    let balance_call = api.tx.balances.transferKeepAlive(
        asset_admin,
        10
    );

    await balance_call.signAndSend(appAgentOwner, { nonce: -1 })
        .then(() => {
            console.log(`Successfully sent some balance to admin.`);
        }).catch((err) => {
            console.log(err);
            console.log(`Couldn't send some balance to admin!`);
            process.exit(1);
        });

    console.log("Wait for the tx to propogate");
    await new Promise(resolve => setTimeout(resolve, 10_000));

    console.log("Create the NFT Collection");
    let create_nft_call = api.tx.nfts.create(
        asset_admin,
        {
            settings: 0,
            mintSettings: {
                mintType: "issuer",
                defaultItemSettings: 0
            }
        }
    );

    let create_nft_ct = api.tx.addressPools.submitClearingTransaction(
        appAgentId,
        [[
            [
                { AppAgentId: appAgentId },
                create_nft_call
            ]
        ]]
    );

    console.log("Wait for the event and get the collection ID");
    let collection_id;

    await new Promise(async (resolve, reject) => {
        const unsubscribe = await create_nft_ct
            .signAndSend(appAgentOwner, { nonce: -1 }, ({ status, events}) => {
                if (status.isFinalized) {
                    events.forEach(({ event }) => {
                        if (api.events.nfts.Created.is(event)) {
                            collection_id = event.data[0].toString();
                            console.log(`NFT Collection token created with ID: ${collection_id}`);
                            unsubscribe();
                            resolve();
                            return;
                        }
                    });
                    unsubscribe();
                    reject("NFT Collection was not created despite the transaction was finalised.");
                }
            });
    }).catch((err) => {
        console.log(err);
        console.log("Failed to create NFT Collection!");
        process.exit(1);
    });

    console.log("Configure NFT Collection");
    let set_team_metadata_call = api.tx.nfts.setTeam(
        collection_id,
        asset_admin,
        asset_admin,
        asset_admin,
    );

    let set_metadata_call = api.tx.nfts.setCollectionMetadata(
        collection_id,
        metadataUrl
    );

    let set_team_metadata_ct = api.tx.addressPools.submitClearingTransaction(
        appAgentId,
        [[
            [
                { NamedAddress: asset_admin },
                set_team_metadata_call
            ],
            [
                { AppAgentId: appAgentId },
                set_metadata_call
            ]
        ]]
    );

    await set_team_metadata_ct.signAndSend(appAgentOwner, { nonce: -1 })
        .then(() => {
            console.log(`NFT Collection ${collection_id} configured.`);
        }).catch((err) => {
            console.log(err);
            console.log(`Couldn't configure NFT Collection ${collection_id}!`);
            process.exit(1);
        });

    console.log("Wait for the tx to propogate");
    await new Promise(resolve => setTimeout(resolve, 10_000));

    console.log("App agent NFTs created successfully");

    return collection_id;
}


async function create_nft_token(api, appAgentOwner, appAgentId, collection_id, metadataUrl, recipient_one, recipient_two) {
    console.log("Start to create NFT Token for the AppAgent ID " + appAgentId);
    
    let asset_admin = encodeNamed(appAgentId, "asset-admi");

    console.log("Generate a random token ID within a specific range (e.g., 1 to 1000000)");
    let tokenId = Math.floor(Math.random() * 1000000) + 1;

    console.log(`Generated token ID: ${tokenId}`);

    console.log("Send some balance to admin");
    let balance_call = api.tx.balances.transferKeepAlive(
        asset_admin,
        10 * 1e12
    );

    await balance_call.signAndSend(appAgentOwner, { nonce: -1 })
        .then(() => {
            console.log(`Successfully sent some balance to admin.`);
        }).catch((err) => {
            console.log(err);
            console.log(`Couldn't send some balance to admin!`);
            process.exit(1);
        });

    console.log("Wait for the tx to propogate");
    await new Promise(resolve => setTimeout(resolve, 10_000));

    console.log("Mint and configure the NFT Token");
    let mint_nft_call = api.tx.nfts.mint(
        collection_id,
        tokenId,
        recipient_one.address,
        {}
    );

    let set_metadata_call = api.tx.nfts.setMetadata(
        collection_id,
        tokenId,
        metadataUrl
    );

    let create_nft_ct = api.tx.addressPools.submitClearingTransaction(
        appAgentId,
        [[
            [
                { NamedAddress: asset_admin },
                mint_nft_call
            ],
            [
                { NamedAddress: asset_admin },
                set_metadata_call
            ]
        ]]
    );

    await create_nft_ct.signAndSend(appAgentOwner, { nonce: -1 })
        .then(() => {
            console.log(`Successfully created and configured the NFT token: ${collection_id}.${tokenId}.`);
        }).catch((err) => {
            console.log(err);
            console.log(`Couldn't create the NFT token!`);
            process.exit(1);
        });

    console.log("Wait for the tx to propogate");
    await new Promise(resolve => setTimeout(resolve, 10_000));

    console.log("NFT token was mint and metadata was set successfully");

    // await create_nft_transfers(api, recipient_one, recipient_two, collection_id, tokenId);
}

async function create_nft_transfers(api, token_recipient, token_recipient_two, collection_id, token_id) {

    console.log("Generate 5 free transfers between the two users");
    let batch_calls_two = [];
    for (let i = 0; i < 5; i++) {
        let free_transfer_call = api.tx.playerTransfers.submitTransferNfts(
            collection_id,
            token_id,
            token_recipient_two.address,
        );
        batch_calls_two.push(free_transfer_call);
    }

    let batch_call_two = api.tx.utility.batchAll(batch_calls_two);

    batch_call_two.signAndSend(token_recipient, { nonce: -1 })
        .then(() => {
            console.log(`Free transfer created`);
        }).catch((err) => {
            console.log(err);
            console.log(`Test failed : free transfer creation failed!`);
            process.exit(1);
        });

    console.log("Wait for the tx to propogate");
    await new Promise(resolve => setTimeout(resolve, 10_000));
}

module.exports = {
    create_nft_collection,
    create_nft_token
}
