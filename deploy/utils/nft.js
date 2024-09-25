const { encodeNamed } = require("./keyless");
const { processClearingTransaction, processSignedTransaction } = require("./utils");

async function create_nft_collections(api, appAgentOwner, appAgentId, collection_count) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("Start to create NFT Collections for the AppAgent ID " + appAgentId);

            let asset_admin = encodeNamed(appAgentId, "asset-admi");
            let collection_ids = [];

            let atomics = [];

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

            // create atomic and push to atomics
            for (let i = 0; i < collection_count; i++) {
                atomics.push([{ AppAgentId: appAgentId }, create_nft_call]);
            }

            let create_nft_ct = api.tx.addressPools.submitClearingTransaction(
                appAgentId,
                [atomics]
            );

            await processClearingTransaction(api, appAgentOwner, create_nft_ct, (event) => {
                if (event.event.section === 'nfts' && event.event.method === 'Created') {
                    const collection_id = event.event.data[0].toString();
                    console.log("NFT Collection created with ID: " + collection_id);
                    collection_ids.push(collection_id);
                }
            });

            console.log("Generated collection IDs: ", collection_ids);

            if (collection_ids.length != collection_count) {
                throw new Error("Not all NFT collections were created");
            }

            console.log("Resolving promise with collection_ids:", collection_ids);
            resolve(collection_ids);
        } catch (error) {
            console.error("Error creating NFT Collections:", error.message);
            reject(error);
        }
    });
}

async function set_metadata_and_mint_nft(api, appAgentOwner, appAgentId, collectionId, collectionInfo, token_recipient) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("Start to create NFT Collection for the AppAgent ID " + appAgentId);
            console.log("Collection ID ", collectionId);
            let asset_admin = encodeNamed(appAgentId, "asset-admi");

            let nftInfo = [];

            // Send balance to admin with retry logic
            console.log("Send some balance to admin");
            let balance_call = api.tx.balances.transferKeepAlive(
                asset_admin,
                100000000000000
            );

            await processSignedTransaction(api, appAgentOwner, balance_call);



            let atomics = [];
            let metadata_set_atomics = [];

            let set_team_metadata_call = api.tx.nfts.setTeam(
                collectionId,
                asset_admin,
                asset_admin,
                asset_admin,
            );

            let set_metadata_call = api.tx.nfts.setCollectionMetadata(
                collectionId,
                collectionInfo.metadataUrl
            );

            atomics.push([{ AppAgentId: appAgentId }, set_team_metadata_call]);
            atomics.push([{ NamedAddress: asset_admin }, set_metadata_call]);

            for (const token of collectionInfo.tokens) {
                let metadataUrl = token.metadataUrl;
                let tokenId = Math.floor(Math.random() * 1000000) + 1;
                nftInfo.push({ collectionId: collectionId, tokenId: tokenId });

                console.log("CollectionId ", collectionId);
                console.log("TokenId ", tokenId);
                console.log("Token metadata", metadataUrl);

                let mint_nft_call = api.tx.nfts.mint(
                    collectionId,
                    tokenId,
                    token_recipient,
                    {}
                );

                let set_metadata_call = api.tx.nfts.setMetadata(
                    collectionId,
                    tokenId,
                    metadataUrl
                );

                atomics.push([{ NamedAddress: asset_admin }, mint_nft_call]);
                metadata_set_atomics.push([{ NamedAddress: asset_admin }, set_metadata_call]);
            }

            let configure_nft_ct = api.tx.addressPools.submitClearingTransaction(
                appAgentId,
                [atomics]
            );

            await processClearingTransaction(api, appAgentOwner, configure_nft_ct, (event) => {
                // if (event.event.section === 'nfts' && event.event.method === 'SetTeam') {
                //     console.log("NFT collection configured successfully");
                // }
            });


            console.log("Sending CT to set metadata for NFT Tokens");
            let set_metadata_ct = api.tx.addressPools.submitClearingTransaction(
                appAgentId,
                [metadata_set_atomics]
            );

            await processClearingTransaction(api, appAgentOwner, set_metadata_ct, (event) => {
                // if (event.event.section === 'nfts' && event.event.method === 'SetMetadata') {
                //     console.log("NFT token metadata set successfully");
                // }
            });

            console.log("Resolving promise with nftInfo:", nftInfo);
            resolve(nftInfo);
        } catch (error) {
            console.error("Error in set_metadata_and_mint_nft:", error.message);
            reject(error);
        }
    });
}

async function create_nft_transfers(api, collection_id, token_id, token_sender, token_recipient) {
    console.log("Generate free transfers between the two users");
    console.log("Collection ID: ", collection_id);
    console.log("Token ID: ", token_id);
    console.log("Token Sender: ", token_sender.address);
    console.log("Token Recipient: ", token_recipient.address);

    const tx = api.tx.playerTransfers.submitTransferNfts(
        collection_id,
        token_id,
        token_recipient.address
    );

    await processSignedTransaction(api, token_sender, tx);
    console.log(`Free transfer created and confirmed`);
}

module.exports = {
    create_nft_collections,
    set_metadata_and_mint_nft,
    create_nft_transfers
}
