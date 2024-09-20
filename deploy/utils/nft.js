const { encodeNamed } = require("./keyless");
const { retryOperation, maxWaitTime } = require("./utils");



async function create_nft_collection(api, appAgentOwner, appAgentId, metadataUrl) {
    console.log("Start to create NFT Collection for the AppAgent ID " + appAgentId);

    let asset_admin = encodeNamed(appAgentId, "asset-admi");
    let collection_id;

    // Send balance to admin with retry logic
    async function sendBalanceToAdmin() {
        console.log("Send some balance to admin");
        let balance_call = api.tx.balances.transferKeepAlive(
            asset_admin,
            10
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

    // Create NFT Collection with retry logic
    async function createNFTCollection() {
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject("Timeout: NFT Collection creation took too long");
            }, maxWaitTime);

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

            const unsubscribe = await create_nft_ct
                .signAndSend(appAgentOwner, { nonce: -1 }, ({ status, events }) => {
                    if (status.isInBlock) {
                        events.forEach(({ event }) => {

                            if (api.events.nfts.Created.is(event)) {
                                collection_id = event.data[0].toString();
                                console.log("NFT Collection created with ID: " + collection_id);
                                collection_id = collection_id.toString();
                            }

                            if (api.events.addressPools.CTProcessingCompleted.is(event)) {
                                let failed_atomic_number = event.data[4].toString();
                                if (failed_atomic_number === "0") {
                                    console.log("CT completed successfully");
                                    clearTimeout(timeout);
                                    unsubscribe();
                                    resolve();
                                    return;
                                }
                            }
                        });
                        clearTimeout(timeout);
                        unsubscribe();
                        reject("NFT Collection was not created despite the transaction being finalised.");
                    }
                });
        });
    }

    await retryOperation(createNFTCollection, "creating NFT Collection");

    // Configure NFT Collection with retry logic
    async function configureNFTCollection() {
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
                    { AppAgentId: appAgentId },
                    set_team_metadata_call
                ],
                [
                    { NamedAddress: asset_admin },
                    set_metadata_call
                ]
            ]]
        );

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject("Timeout: Configuring NFT Collection took too long");
            }, maxWaitTime);

            set_team_metadata_ct.signAndSend(appAgentOwner, { nonce: -1 }, ({ status, events }) => {
                if (status.isInBlock) {
                    events.forEach(({ event }) => {
                        if (api.events.addressPools.CTProcessingCompleted.is(event)) {
                            let failed_atomic_number = event.data[4].toString();
                            if (failed_atomic_number === "0") {
                                console.log("CT completed successfully");
                                clearTimeout(timeout);
                                resolve();
                                return;
                            }
                        }
                    });
                    clearTimeout(timeout);
                    reject("CT did not complete successfully");
                }
            }).catch((err) => {
                clearTimeout(timeout);
                reject(`Couldn't configure NFT Collection: ${err}`);
            });
        });
    }

    await retryOperation(configureNFTCollection, "configuring NFT Collection");

    console.log("App agent NFTs created successfully");

    return collection_id;
}

async function create_nft_token(api, appAgentOwner, appAgentId, collection_id, metadataUrl, recipient_one, recipient_two) {
    console.log("Start to create NFT Token for the AppAgent ID " + appAgentId);

    let asset_admin = encodeNamed(appAgentId, "asset-admi");
    let tokenId = Math.floor(Math.random() * 1000000) + 1;

    console.log(`Generated token ID: ${tokenId}`);

    // Send balance to admin with retry logic
    async function sendBalanceToAdmin() {
        console.log("Send some balance to admin");
        let balance_call = api.tx.balances.transferKeepAlive(
            asset_admin,
            10 * 1e12
        );

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject("Timeout: Sending balance to admin took too long");
            }, maxWaitTime);

            const unsubscribe = balance_call.signAndSend(appAgentOwner, { nonce: -1 }, ({ status, events }) => {
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

    // Mint and configure NFT Token with retry logic
    async function mintAndConfigureNFTToken() {
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

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject("Timeout: Minting and configuring NFT Token took too long");
            }, maxWaitTime);

            create_nft_ct.signAndSend(appAgentOwner, { nonce: -1 }, ({ status, events }) => {
                if (status.isInBlock) {
                    events.forEach(({ event }) => {
                        if (api.events.addressPools.CTProcessingCompleted.is(event)) {
                            let failed_atomic_number = event.data[4].toString();
                            if (failed_atomic_number === "0") {
                                console.log("CT completed successfully");
                                clearTimeout(timeout);
                                resolve();
                                return;
                            }
                        }
                    });
                    clearTimeout(timeout);
                    reject("CT did not complete successfully");
                }
            }).catch((err) => {
                clearTimeout(timeout);
                reject(`Couldn't mint and configure NFT Token: ${err}`);
            });
        });
    }

    await retryOperation(mintAndConfigureNFTToken, "minting and configuring NFT Token");

    console.log("NFT token was minted and metadata was set successfully");

    await create_nft_transfers(api, recipient_one, recipient_two, collection_id, tokenId);
}

async function create_nft_transfers(api, token_recipient, token_recipient_two, collection_id, token_id) {
    console.log("Generate free transfers between the two users");
    console.log("Collection ID: ", collection_id);
    console.log("Token ID: ", token_id);


    await retryOperation(async () => {
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Timeout: Transfer took too long`));
            }, maxWaitTime);

            try {
                const unsubscribe = await api.tx.playerTransfers.submitTransferNfts(
                    collection_id,
                    token_id,
                    token_recipient_two.address,
                ).signAndSend(token_recipient, { nonce: -1 }, ({ status, events }) => {
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
                if (error.message.includes("Priority is too low")) {
                    console.log("Priority too low. Retrying with increased delay.");
                    await new Promise(resolve => setTimeout(resolve, 5000)); // Additional delay
                }
                reject(error);
            }
        });
    }, `creating free transfer`);

    console.log(`Free transfer created and confirmed`);

}

module.exports = {
    create_nft_collection,
    create_nft_token
}
