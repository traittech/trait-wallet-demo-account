const { encodeNamed } = require("./keyless");
const { processClearingTransaction, retryOperation, maxWaitTime } = require("./utils");

async function create_nft_collections(api, appAgentOwner, appAgentId, collection_count) {
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

    try {
        await processClearingTransaction(api, appAgentOwner, create_nft_ct, (event) => {
            if (event.event.section === 'nfts' && event.event.method === 'Created') {
                const collection_id = event.event.data[0].toString();
                console.log("NFT Collection created with ID: " + collection_id);
                collection_ids.push(collection_id);
            }
        });

        console.log("Generated collection IDs: ", collection_ids);

        if (collection_ids.length === 0) {
            throw new Error("No collection IDs were generated");
        }

        return collection_ids;
    } catch (error) {
        console.error("Error creating NFT Collections:", error.message);
        throw error;
    }
}

async function set_metadata_and_mint_nft(api, appAgentOwner, appAgentId, collectionId, collectionInfo, token_recipient) {
    console.log("Start to create NFT Collection for the AppAgent ID " + appAgentId);
    console.log("Collection ID ", collectionId);
    let asset_admin = encodeNamed(appAgentId, "asset-admi");

    let nftInfo = [];

    // Send balance to admin with retry logic
    async function sendBalanceToAdmin() {
        console.log("Send some balance to admin");
        let balance_call = api.tx.balances.transferKeepAlive(
            asset_admin,
            100000000000000
        );

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject("Timeout: Sending balance to admin took too long");
            }, maxWaitTime);

            balance_call.signAndSend(appAgentOwner, { nonce: -1 }, ({ status, events }) => {
                if (status.isInBlock) {
                    console.log(`Successfully sent some balance to admin. Transaction included in block: ${status.asInBlock.toHex()}`);
                    clearTimeout(timeout);
                    resolve();
                } else if (status.isError) {
                    console.error(`Transaction failed: ${status.toHuman()}`);
                    clearTimeout(timeout);
                    reject(new Error(`Transaction failed: ${status.toHuman()}`));
                }
            }).then(unsub => {
                // Store the unsubscribe function
                const unsubscribe = () => {
                    unsub();
                    clearTimeout(timeout);
                };
                // Attach unsubscribe to the promise
                resolve.unsubscribe = unsubscribe;
            }).catch((err) => {
                clearTimeout(timeout);
                console.error(`Couldn't send balance to admin: ${err}`);
                reject(err);
            });
        });
    }

    await retryOperation(async () => {
        const promise = sendBalanceToAdmin();
        try {
            await promise;
        } finally {
            if (promise.unsubscribe) {
                promise.unsubscribe();
            }
        }
    }, "sending balance to admin");

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

    try {
        await processClearingTransaction(api, appAgentOwner, configure_nft_ct, (event) => {
            console.log(`Event: ${event.event.section}.${event.event.method}`);
        });

        console.log("NFT collection configured successfully");
    } catch (error) {
        console.error("Error configuring NFT Collection:", error.message);
        throw error;
    }

    console.log("Sending CT to set metadata for NFT Tokens");
    let set_metadata_ct = api.tx.addressPools.submitClearingTransaction(
        appAgentId,
        [metadata_set_atomics]
    );

    try {
        await processClearingTransaction(api, appAgentOwner, set_metadata_ct, (event) => {
            console.log(`Event: ${event.event.section}.${event.event.method}`);
            if (event.event.section === 'nfts' && event.event.method === 'MetadataSet') {
                console.log(`Metadata set for token: ${event.event.data[1].toString()} in collection: ${event.event.data[0].toString()}`);
            }
        });

        console.log("NFT token metadata set successfully");
        return nftInfo;
    } catch (error) {
        console.error("Error setting NFT token metadata:", error.message);
        throw error;
    }
}


async function create_nft_transfers(api, collection_id, token_id, token_sender, token_recipient) {
    console.log("Generate free transfers between the two users");
    console.log("Collection ID: ", collection_id);
    console.log("Token ID: ", token_id);
    console.log("Token Sender: ", token_sender.address);
    console.log("Token Recipient: ", token_recipient.address);

    await retryOperation(async () => {
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Timeout: Transfer took too long`));
            }, maxWaitTime);

            try {
                const unsubscribe = await api.tx.playerTransfers.submitTransferNfts(
                    collection_id,
                    token_id,
                    token_recipient.address,
                ).signAndSend(token_sender, { nonce: -1 }, ({ status, events }) => {
                    if (status.isInBlock) {
                        let extrinsicSuccess = false;
                        events.forEach(({ event }) => {
                            if (api.events.system.ExtrinsicSuccess.is(event)) {
                                extrinsicSuccess = true;
                            }
                        });

                        if (extrinsicSuccess) {
                            console.log(`Transfer is in block and successful`);
                            clearTimeout(timeout);
                            unsubscribe();
                            resolve();
                        } else {
                            clearTimeout(timeout);
                            unsubscribe();
                            reject(new Error(`Transfer failed: ExtrinsicSuccess event not found`));
                        }
                    } else if (status.isError) {
                        clearTimeout(timeout);
                        // unsubscribe();
                        // reject(new Error(`Transfer failed with error status`));
                    }
                });
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }, `creating free transfer`);

    console.log(`Free transfer created and confirmed`);

}

module.exports = {
    create_nft_collections,
    set_metadata_and_mint_nft,
    create_nft_transfers
}
