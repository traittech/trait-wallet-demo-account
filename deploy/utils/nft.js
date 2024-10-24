const { encodeNamed } = require("./keyless");
const { processClearingTransaction, processSignedTransaction } = require("./utils");

async function create_nft_collections(api, appAgentOwner, appAgentId, collection_count) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("Start to create NFT Collections for the AppAgent ID " + appAgentId);

            console.log("Create Clearing transaction");
            let atomics = [];

            let create_nft_call = api.tx.nfts.create();
            
            for (let i = 0; i < collection_count; i++) {
                let create_nft_action = [{ AppAgentId: appAgentId }, create_nft_call];
                let create_nft_atomic = [create_nft_action];
                atomics.push(create_nft_atomic);
            }

            let create_nft_ct = api.tx.addressPools.submitClearingTransaction(
                appAgentId,
                atomics
            );

            let events = await processClearingTransaction(appAgentOwner, create_nft_ct);

            console.log("Clearing transaction successfully processed, collect IDs of created NFT collections.");
            let collection_ids = [];
            for (const event of events) {
                if (event.receipt.event_module === 'Nfts' && event.receipt.event_name === 'Created') {
                    const collection_id = event.attributes.collection.toString();
                    console.log("NFT Collection created with ID: " + collection_id);
                    collection_ids.push(collection_id);
                }
            }
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
            console.log("Start to configure NFT Collection `" + collectionId + "` for the AppAgent ID " + appAgentId);
            let asset_admin = encodeNamed(appAgentId, "assetadmin");

            let nftInfo = [];

            console.log("Send some balance to admin");
            let balance_call = api.tx.balances.transferKeepAlive(
                asset_admin,
                100000000000000
            );

            await processSignedTransaction(appAgentOwner, balance_call);

            console.log("Build Clearing transaction to setup NFT collection");
            // As we have a small number of NFT tokens in each collection - only 10 -
            // we can join all operations into a single CT.
            let atomics = [];

            console.log("Create atomic to set collection metadata");
            let set_collection_metadata_call = api.tx.nfts.setCollectionMetadata(
                collectionId,
                collectionInfo.metadataUrl
            );
            let set_collection_metadata_action = [{ NamedAddress: asset_admin }, set_collection_metadata_call];
            let set_collection_metadata_atomic = [set_collection_metadata_action];
            atomics.push(set_collection_metadata_atomic);

            console.log("Create atomics to mint and configure NFT tokens.");
            for (const token of collectionInfo.tokens) {
                let metadataUrl = token.metadataUrl;
                let tokenId = Math.floor(Math.random() * 1000000) + 1;
                nftInfo.push({ collectionId: collectionId, tokenId: tokenId });

                console.log("Create atomic for NFT token: CollectionId - " + collectionId + "; TokenId - " + tokenId + "; metadata URL: " + metadataUrl);

                let mint_nft_call = api.tx.nfts.mint(
                    collectionId,
                    tokenId,
                    token_recipient
                );
                let mint_nft_action = [{ NamedAddress: asset_admin }, mint_nft_call];
                let set_metadata_call = api.tx.nfts.setMetadata(
                    collectionId,
                    tokenId,
                    metadataUrl
                );
                let set_metadata_action = [{ NamedAddress: asset_admin }, set_metadata_call];
                let nft_atomic = [mint_nft_action, set_metadata_action];
                atomics.push(nft_atomic);
            }
            
            console.log("Sending CT to mint & configure NFT Tokens, and to set Collection metadata.");
            let configure_nft_collection_ct = api.tx.addressPools.submitClearingTransaction(
                appAgentId,
                atomics
            );
            await processClearingTransaction(appAgentOwner, configure_nft_collection_ct);

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

    await processSignedTransaction(token_sender, tx);
    console.log(`Free transfer created and confirmed`);
}

module.exports = {
    create_nft_collections,
    set_metadata_and_mint_nft,
    create_nft_transfers
}
