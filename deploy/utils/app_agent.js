const { retryOperation, maxWaitTime } = require("./utils");

async function create_app_agent(api, appAgentOwner, metadataUrl) {
    console.log("Start to create AppAgent for the owner: " + appAgentOwner.address);

    let appagentId;

    async function sendCreateAppAgentTx() {
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject("Timeout: AppAgent creation took too long");
            }, maxWaitTime);

            const unsubscribe = await api.tx.appAgents.createAppAgent()
                .signAndSend(appAgentOwner, { nonce: -1 }, ({ status, events }) => {
                    if (status.isInBlock) {
                        events.forEach(({ event }) => {
                            if (api.events.appAgents.AppAgentCreated.is(event)) {
                                const [newAppAgentId, ownerAddress] = event.data;
                                appagentId = newAppAgentId;
                                console.log(`App agent created: ID ${newAppAgentId.toString()} for owner ${ownerAddress.toString()}`);
                                clearTimeout(timeout);
                                unsubscribe();
                                resolve();
                                return;
                            }
                        });
                        clearTimeout(timeout);
                        unsubscribe();
                        reject("AppAgent was not created despite the transaction being finalised.");
                    }
                });
        });
    }

    await retryOperation(sendCreateAppAgentTx, "creating AppAgent");

    console.log("Create the transaction to set the metadata");
    let set_metadata_tx = api.tx.appAgents.setAppAgentMetadata(
        appagentId,
        metadataUrl
    );

    console.log("Sign and send the transaction");
    async function sendSetMetadataTx() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject("Timeout: Setting metadata took too long");
            }, maxWaitTime);

            set_metadata_tx.signAndSend(appAgentOwner, { nonce: -1 }, ({ status, events }) => {
                if (status.isInBlock) {
                    events.forEach(({ event }) => {
                        if (api.events.appAgents.AppAgentMetadataSet.is(event)) {
                            console.log("Metadata URL set successfully");
                            clearTimeout(timeout);
                            resolve();
                            return;
                        }
                    });
                    clearTimeout(timeout);
                    reject("MetadataSet event not found in the block");
                }
            }).catch((err) => {
                clearTimeout(timeout);
                console.error("Error setting metadata URL:", err);
                reject(err);
            });
        });
    }

    await retryOperation(sendSetMetadataTx, "setting metadata URL");

    return appagentId;
}

module.exports = {
    create_app_agent
}
