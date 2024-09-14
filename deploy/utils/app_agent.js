const { ApiPromise, WsProvider } = require("@polkadot/api");
const { Keyring } = require("@polkadot/keyring");
const { encodeNamed } = require("./keyless");

async function create_app_agent(api, appAgentOwner, metadataUrl) {
    console.log("Start to create AppAgent for the owner: " + appAgentOwner.address);

    let appagentId;
    await new Promise(async (resolve, reject) => {
        const unsubscribe = await api.tx.appAgents.createAppAgent()
            .signAndSend(appAgentOwner, ({ status, events }) => {
                if (status.isFinalized) {
                    events.forEach(({ event }) => {
                        if (api.events.appAgents.AppAgentCreated.is(event)) {
                            const [newAppAgentId, ownerAddress] = event.data;
                            console.log(`App agent created: ID ${newAppAgentId.toString()} for owner ${ownerAddress.toString()}`);
                            appagentId = newAppAgentId;
                            unsubscribe();
                            resolve();
                            return;
                        }
                    });
                    unsubscribe();
                    reject("Failed to create AppAgent.");
                }
            });
    });

    console.log("Create the transaction to set the metadata");
    let set_metadata_tx = api.tx.appAgents.setAppAgentMetadata(
        appagentId,
        metadataUrl
    );

    console.log("Sign and send the transaction");
    await set_metadata_tx.signAndSend(appAgentOwner)
        .then(() => {
            console.log("Metadata URL set successfully");
        })
        .catch(err => {
            console.error("Error setting metadata URL:", err);
        });

    console.log("Wait for the tx to propogate");
    await new Promise(resolve => setTimeout(resolve, 10_000));

    return appagentId;
}

module.exports = {
    create_app_agent
}