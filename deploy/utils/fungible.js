const { encodeNamed } = require("./keyless");
const { retryOperation, maxWaitTime } = require("./utils");

async function create_fungible_token(api, appAgentOwner, appAgentId, token_recipient, token_recipient_two, metadataUrl) {
    console.log("Start to create fungible token for the AppAgent ID " + appAgentId);

    let token_admin = encodeNamed(appAgentId, "asset-admi");
    let token_id;

    async function sendCreateFungibleTokenTx() {
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject("Timeout: Fungible token creation took too long");
            }, maxWaitTime);

            let create_fungible_token = api.tx.assets.create(token_admin, 1);
            let create_fungible_token_ct = api.tx.addressPools.submitClearingTransaction(
                appAgentId,
                [[[{ AppAgentId: appAgentId }, create_fungible_token]]]
            );

            const unsubscribe = await create_fungible_token_ct
                .signAndSend(appAgentOwner, { nonce: -1 }, ({ status, events }) => {
                    if (status.isInBlock) {
                        events.forEach(({ event }) => {
                            if (api.events.assets.Created.is(event)) {
                                token_id = event.data[0].toString();
                                console.log(`Fungible token created with ID: ${token_id}`);
                                clearTimeout(timeout);
                                unsubscribe();
                                resolve();
                                return;
                            }
                        });
                        clearTimeout(timeout);
                        unsubscribe();
                        reject("Fungible token was not created despite the transaction being finalised.");
                    }
                });
        });
    }

    await retryOperation(sendCreateFungibleTokenTx, "creating Fungible Token");

    console.log("Configure fungible token and mint tokens");

    async function sendConfigureFungibleTokenTx() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject("Timeout: Configuring fungible token took too long");
            }, maxWaitTime);

            let set_metadata_call = api.tx.assets.setMetadata(token_id, metadataUrl);
            const mint_tokens_call = api.tx.assets.mint(token_id, token_recipient.address, 1000);

            let configure_fungible_ct = api.tx.addressPools.submitClearingTransaction(
                appAgentId,
                [
                    [
                        [{ AppAgentId: appAgentId }, set_metadata_call],
                        [{ NamedAddress: token_admin }, mint_tokens_call]
                    ]
                ]
            );

            configure_fungible_ct.signAndSend(appAgentOwner, { nonce: -1 }, ({ status, events }) => {
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
                reject(`Couldn't configure fungible token ${token_id}: ${err}`);
            });
        });
    }

    await retryOperation(sendConfigureFungibleTokenTx, "configuring Fungible Token");

    // wait 12 secs
    await new Promise(resolve => setTimeout(resolve, 12000));
    await create_token_transfers(api, token_id, token_recipient, token_recipient_two);
}

async function create_token_transfers(api, token_id, token_recipient, token_recipient_two) {
    console.log("Generate 5 free transfers between the two users");
    console.log("Token ID: ", token_id);
    console.log("Token recipient: ", token_recipient.address);
    console.log("Token recipient two: ", token_recipient_two.address);

    for (let i = 0; i < 5; i++) {
        await retryOperation(async () => {
            return new Promise(async (resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error(`Timeout: Transfer ${i + 1} took too long`));
                }, maxWaitTime);

                try {
                    const unsubscribe = await api.tx.playerTransfers.submitTransferAssets(
                        token_id,
                        token_recipient_two.address,
                        10
                    ).signAndSend(token_recipient, { nonce: -1 }, ({ status, events }) => {
                        if (status.isInBlock) {
                            let extrinsicSuccess = false;
                            events.forEach(({ event }) => {
                                if (api.events.system.ExtrinsicSuccess.is(event)) {
                                    extrinsicSuccess = true;
                                }
                            });

                            if (extrinsicSuccess) {
                                console.log(`Transfer ${i + 1} is in block and successful`);
                                clearTimeout(timeout);
                                unsubscribe();
                                resolve();
                            } else {
                                clearTimeout(timeout);
                                unsubscribe();
                                reject(new Error(`Transfer ${i + 1} failed: ExtrinsicSuccess event not found`));
                            }
                        } else if (status.isError) {
                            clearTimeout(timeout);
                            unsubscribe();
                            reject(new Error(`Transfer ${i + 1} failed with error status`));
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
        }, `creating free transfer ${i + 1}`, {
            retryInterval: (attempt) => Math.min(2000 * Math.pow(2, attempt), 30000), // Exponential backoff
            shouldRetry: (error) => {
                if (error.message.includes("Priority is too low")) {
                    console.log("Priority too low. Will retry with increased delay.");
                    return true;
                }
                return error.message.includes("Timeout") || error.message.includes("failed");
            }
        });

        console.log(`Free transfer ${i + 1} created and in block`);
    }

    console.log("All transfers completed successfully");
    console.log("App agent assets created successfully");
}

module.exports = {
    create_fungible_token
}
