const { ApiPromise, WsProvider } = require("@polkadot/api");
const { Keyring } = require("@polkadot/keyring");
const { encodeNamed } = require("./keyless");

async function create_app_agent_nft_collection(api, appAgentOwner, appAgentId, metadataUrl) {
    let asset_admin = encodeNamed(appAgentId, "asset-admi");

    // send some balance to admin
    let balance_call = api.tx.balances.transferKeepAlive(
        asset_admin,
        10
    );

    await balance_call.signAndSend(appAgentOwner);

    // wait for the tx to propogate
    await new Promise(resolve => setTimeout(resolve, 10_000));

    // Create the NFT Collection
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

    // Wait for the event and get the collection ID
    let collection_id;
    await new Promise((resolve, reject) => {
        create_nft_ct.signAndSend(appAgentOwner, { nonce: -1 }, ({ events = [], status }) => {
            if (status.isInBlock || status.isFinalized) {
                events.forEach(({ event: { data, method, section } }) => {
                    if (section === 'nfts' && method === 'Created') {
                        collection_id = data[0].toString();
                        console.log(`NFT Collection created with ID: ${collection_id}`);
                        resolve();
                    }
                });
            }
        }).catch((error) => {
            console.error("Error creating NFT collection:", error);
            reject(error);
        });
    });

    // wait for the tx to propogate
    await new Promise(resolve => setTimeout(resolve, 10_000));

    // set the metadata
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

    // wait for the tx to propogate
    await new Promise(resolve => setTimeout(resolve, 10_000));

    console.log("App agent NFTs created successfully");

    return collection_id;
}


async function create_app_agent_nft_token(api, appAgentOwner, appAgentId, collection_id, metadataUrl, recipient_one, recipient_two) {
    let asset_admin = encodeNamed(appAgentId, "asset-admi");

    // Generate a random token ID within a specific range (e.g., 1 to 1000)
    let tokenId = Math.floor(Math.random() * 1000) + 1;

    console.log(`Generated token ID: ${tokenId}`);

    // send some balance to admin
    let balance_call = api.tx.balances.transferKeepAlive(
        asset_admin,
        10 * 1e12
    );

    await balance_call.signAndSend(appAgentOwner);

    // wait for the tx to propogate
    await new Promise(resolve => setTimeout(resolve, 10_000));

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

    let set_metadata_ct = api.tx.addressPools.submitClearingTransaction(
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

    await set_metadata_ct.signAndSend(appAgentOwner, { nonce: -1 });

    // wait for the tx to propogate
    await new Promise(resolve => setTimeout(resolve, 10_000));

    console.log("App agent NFT metadata set successfully");

    await create_nft_transfers(api, recipient_one, recipient_two, collection_id, tokenId);
}

async function create_nft_transfers(api, token_recipient, token_recipient_two, collection_id, token_id) {

    // generate 5 free transfers between the two users
    let batch_calls_two = [];
    for (let i = 0; i < 5; i++) {
        let free_transfer_call = api.tx.playerTransfers.submitTransferNfts(
            collection_id,
            token_id,
            token_recipient_two.address,
        );
        batch_calls_two.push(free_transfer_call);
    }

    let batch_call_two = api.tx.utility.batch_all(batch_calls_two);

    batch_call_two.signAndSend(token_recipient, { nonce: -1 })
        .then(() => {
            console.log(`Free transfer created`);
        }).catch((err) => {
            console.log(err);
            console.log(`Test failed : free transfer creation failed!`);
            process.exit(1);
        });

    // wait for the tx to propogate
    await new Promise(resolve => setTimeout(resolve, 10_000));
}

module.exports = {
    create_app_agent_nft_collection,
    create_app_agent_nft_token
}