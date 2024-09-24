const { processSignedTransaction } = require("./utils");

async function create_app_agent(api, appAgentOwner, metadataUrl) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("Start to create AppAgent for the owner: " + appAgentOwner.address);

            let appagentId;

            let tx = api.tx.appAgents.createAppAgent();
            await processSignedTransaction(api, appAgentOwner, tx, (event) => {
                if (api.events.appAgents.AppAgentCreated.is(event)) {
                    const [newAppAgentId, ownerAddress] = event.data;
                    appagentId = newAppAgentId;
                }
            });

            console.log("Create the transaction to set the metadata");
            let set_metadata_tx = api.tx.appAgents.setAppAgentMetadata(
                appagentId,
                metadataUrl
            );
            await processSignedTransaction(api, appAgentOwner, set_metadata_tx);

            resolve(appagentId);
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = {
    create_app_agent
}