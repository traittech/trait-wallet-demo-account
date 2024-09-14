const { ApiPromise, WsProvider } = require("@polkadot/api");
const { Keyring } = require("@polkadot/keyring");
const { encodeNamed } = require("./keyless");

async function create_app_agent_fungible_token(api, appAgentOwner, appAgentId, token_recipient, token_recipient_two, metadataUrl) {
    // Create fungible token
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

    // Wait for the event and get the token ID
    let token_id;
    await create_fungible_token_ct.signAndSend(appAgentOwner, { nonce: -1 }, ({ events = [], status }) => {
        if (status.isInBlock || status.isFinalized) {
            events.forEach(({ event: { data, method, section } }) => {
                if (section === 'assets' && method === 'Created') {
                    const tokenId = data[0].toString();
                    console.log(`Fungible token created with ID: ${tokenId}`);
                    token_id = tokenId;
                }
            });
        }
    }).catch((error) => {
        console.error("Error creating fungible token:", error);
    });

    // wait for the tx to propogate
    await new Promise(resolve => setTimeout(resolve, 10_000));

    // Configure app agent and mint tokens
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
            console.log(`Test failed : couldn't configure fungible token ${token_id}!`);
            process.exit(1);
        });

    // wait for the tx to propogate
    await new Promise(resolve => setTimeout(resolve, 10_000));

    await create_token_transfers(api, token_id, token_recipient, token_recipient_two);
}

async function create_token_transfers(api, token_id, token_recipient, token_recipient_two) {
    // generate 5 free transfers between the two users
    let batch_calls_two = [];
    for (let i = 0; i < 5; i++) {
        let free_transfer_call = api.tx.playerTransfers.submitTransferAssets(
            token_id,
            token_recipient_two.address,
            10
        );

        batch_calls_two.push(free_transfer_call);
    }

    let batch_call_two = api.tx.utility.batch_all(batch_calls_two);

    batch_call_two.signAndSend(token_recipient, { nonce: -1 })
        .then(() => {
            console.log(`Free transfer created`);
        }).catch((err) => {
            console.log(err);
            console.log(`Test failed : free transfer creation failed!`);
            process.exit(1);
        });

    // wait for the tx to propogate
    await new Promise(resolve => setTimeout(resolve, 10_000));

    console.log("App agent assets created successfully");
}


module.exports = {
    create_app_agent_fungible_token
}