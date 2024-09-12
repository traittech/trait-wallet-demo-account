const { ApiPromise, WsProvider } = require("@polkadot/api");
const { Keyring } = require("@polkadot/keyring");
const { encodeNamed } = require("./keyless");

async function create_app_agent(api, appAgentOwner, metadataUrl) {
    await new Promise(resolve => setTimeout(resolve, 10_000)); // wait for the previous tx to propogate

    let appagentId;
    await new Promise((resolve, reject) => {
        api.tx.appAgents.createAppAgent()
            .signAndSend(appAgentOwner, ({ status, events }) => {
                if (status.isInBlock || status.isFinalized) {
                    events.forEach(({ event }) => {
                        if (api.events.appAgents.AppAgentCreated.is(event)) {
                            const [newAppAgentId, ownerAddress] = event.data;
                            console.log(`App agent created: ID ${newAppAgentId.toString()} for owner ${ownerAddress.toString()}`);
                            appagentId = newAppAgentId;
                            resolve();
                        }
                    });
                }
            })
            .catch(reject);
    });

    await new Promise(resolve => setTimeout(resolve, 10_000)); // wait for the previous tx to propogate

    // create the transaction to set the metadata
    let set_metadata_tx = api.tx.appAgents.setAppAgentMetadata(
        appagentId,
        metadataUrl
    );

    // sign and send the transaction
    await set_metadata_tx.signAndSend(appAgentOwner)
        .then(() => {
            console.log("Metadata URL set successfully");
        })
        .catch(err => {
            console.error("Error setting metadata URL:", err);
        });

    return appagentId;
}

module.exports = {
    create_app_agent
}