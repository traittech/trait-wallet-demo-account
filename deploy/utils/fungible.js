const { encodeNamed } = require("./keyless");

async function create_fungible_token(api, appAgentOwner, appAgentId, token_recipient, token_recipient_two, metadataUrl) {
    console.log("Start to create fungible token for the AppAgent ID " + appAgentId);

    let token_admin = encodeNamed(appAgentId, "asset-admi");

    let create_fungible_token = api.tx.assets.create(
        token_admin,
        1
    );
    let create_fungible_token_ct = api.tx.addressPools.submitClearingTransaction(
        appAgentId,
        [[
            [
                { AppAgentId: appAgentId },
                create_fungible_token
            ]
        ]]
    );

    let token_id;
    await new Promise(async (resolve, reject) => {
        const unsubscribe = await create_fungible_token_ct
            .signAndSend(appAgentOwner, { nonce: -1 }, ({ status, events}) => {
                if (status.isFinalized) {
                    events.forEach(({ event }) => {
                        if (api.events.assets.Created.is(event)) {
                            token_id = event.data[0].toString();
                            console.log(`Fungible token created with ID: ${token_id}`);
                            unsubscribe();
                            resolve();
                            return;
                        }
                    });
                    unsubscribe();
                    reject("Fungible token was not created despite the transaction was finalised.");
                }
            });
    }).catch((err) => {
        console.log(err);
        console.log("Failed to create fungible token!");
        process.exit(1);
    });

    console.log("Configure fungible token and mint tokens");
    let set_metadata_call = api.tx.assets.setMetadata(
        token_id,
        metadataUrl
    );

    const mint_tokens_call = api.tx.assets.mint(
        token_id,
        token_recipient.address,
        1000
    );

    let configure_fungible_ct = api.tx.addressPools.submitClearingTransaction(
        appAgentId,
        [[
            [
                { AppAgentId: appAgentId },
                set_metadata_call
            ],
            [
                { NamedAddress: token_admin },
                mint_tokens_call
            ]
        ]]
    );

    await configure_fungible_ct.signAndSend(appAgentOwner, { nonce: -1 })
        .then(() => {
            console.log(`Fungible token ${token_id} configured.`);
        }).catch((err) => {
            console.log(err);
            console.log(`Couldn't configure fungible token ${token_id}!`);
            process.exit(1);
        });

    console.log("Wait for the tx to propogate");
    await new Promise(resolve => setTimeout(resolve, 10_000));

    // await create_token_transfers(api, token_id, token_recipient, token_recipient_two);
}

async function create_token_transfers(api, token_id, token_recipient, token_recipient_two) {
    console.log("Generate 5 free transfers between the two users");
    // batchAll doesn't work here
    // since it has it's own weight and accounts need to have some TRAIT tokens to pay fees

    const nonce = await api.rpc.system.accountNextIndex(token_recipient.address);

    for (let i = 0; i < 5; i++) {
        await api.tx.playerTransfers.submitTransferAssets(
            token_id,
            token_recipient_two.address,
            10
        ).signAndSend(token_recipient, { nonce: nonce + i })
        .then(() => {
            console.log(`Free transfer created`);
        }).catch((err) => {
            console.log(err);
            console.log("Free transfer creation failed!");
            process.exit(1);
        });
    }

    console.log("Wait for the tx to propogate");
    await new Promise(resolve => setTimeout(resolve, 10_000));

    console.log("App agent assets created successfully");
}

module.exports = {
    create_fungible_token
}
