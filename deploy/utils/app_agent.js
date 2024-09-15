async function create_app_agent(api, appAgentOwner, metadataUrl) {
    console.log("Start to create AppAgent for the owner: " + appAgentOwner.address);

    let appagentId;
    await new Promise(async (resolve, reject) => {
        const unsubscribe = await api.tx.appAgents.createAppAgent()
            .signAndSend(appAgentOwner, { nonce: -1 }, ({ status, events }) => {
                if (status.isFinalized) {
                    events.forEach(({ event }) => {
                        if (api.events.appAgents.AppAgentCreated.is(event)) {
                            const [newAppAgentId, ownerAddress] = event.data;
                            appagentId = newAppAgentId;
                            console.log(`App agent created: ID ${newAppAgentId.toString()} for owner ${ownerAddress.toString()}`);
                            unsubscribe();
                            resolve();
                            return;
                        }
                    });
                    unsubscribe();
                    reject("AppAgent was not created despite the transaction was finalised.");
                }
            });
    }).catch((err) => {
        console.log(err);
        console.log("Failed to create AppAgent");
        process.exit(1);
    });;

    console.log("Create the transaction to set the metadata");
    let set_metadata_tx = api.tx.appAgents.setAppAgentMetadata(
        appagentId,
        metadataUrl
    );

    console.log("Sign and send the transaction");
    await set_metadata_tx.signAndSend(appAgentOwner, { nonce: -1 })
        .then(() => {
            console.log("Metadata URL set successfully");
        })
        .catch((err) => {
            console.log(err);
            console.error("Error setting metadata URL!");
            process.exit(1);
        });

    // Wait for the tx to propogate
    await new Promise(resolve => setTimeout(resolve, 10_000));

    return appagentId;
}

module.exports = {
    create_app_agent
}
