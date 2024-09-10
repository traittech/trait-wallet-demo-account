const { ApiPromise, WsProvider } = require("@polkadot/api");
const { Keyring } = require("@polkadot/keyring");
const { encodeNamed } = require("./keyless");
const dotenv = require("dotenv");

dotenv.config();

async function main() {
    // Read WS_PROVIDER_URL from .env file
    const wsProviderUrl = process.env.WS_PROVIDER_URL;
    if (!wsProviderUrl) {
        throw new Error("WS_PROVIDER_URL is not set in the .env file");
    }

    // Create a provider with the URL from .env
    const provider = new WsProvider(wsProviderUrl);

    // Instantiate the API with the provider
    const api = await ApiPromise.create({
        provider,
        types: {
            TraitPrimitivesAppAgentCtActionOrigin: {
                _enum: {
                    AppAgentId: 'u32',
                    AppAgentAddress: 'AccountId',
                    TransactionalAddressId: 'u32',
                    TransactionalAddress: 'AccountId',
                    NamedAddress: 'AccountId',
                    NamedAddressName: 'Vec<u8>'
                }
            }
        }
    });

    // Construct the keyring
    const keyring = new Keyring({ type: "sr25519" });

    // Load accounts from .env file
    const sudoAccount = keyring.addFromUri(process.env.SUDO_ACCOUNT_MNEMONIC);
    const appAgentOne = keyring.addFromUri(process.env.APP_AGENT_OWNER_ONE_MNEMONIC);
    const appAgentTwo = keyring.addFromUri(process.env.APP_AGENT_OWNER_TWO_MNEMONIC);
    const appAgentThree = keyring.addFromUri(process.env.APP_AGENT_OWNER_THREE_MNEMONIC);

    const demo_user_one = keyring.addFromUri(process.env.DEMO_ACCOUNT_ONE_MNEMONIC);
    const demo_user_two = keyring.addFromUri(process.env.DEMO_ACCOUNT_TWO_MNEMONIC);
    const demo_user_three = keyring.addFromUri(process.env.DEMO_ACCOUNT_THREE_MNEMONIC);

    const transferAmount = parseInt(process.env.TRANSFER_AMOUNT) * 1e12;

    // Create a batch of transfers
    const transfers = [
        api.tx.balances.transferKeepAlive(appAgentOne.address, transferAmount.toString()),
        api.tx.balances.transferKeepAlive(appAgentTwo.address, transferAmount.toString()),
        api.tx.balances.transferKeepAlive(appAgentThree.address, transferAmount.toString())
    ];

    // Send the batch of transfers
    await new Promise((resolve, reject) => {
        api.tx.utility
            .batchAll(transfers)
            .signAndSend(sudoAccount, ({ status, events }) => {
                if (status.isInBlock || status.isFinalized) {
                    events.forEach(({ event }) => {
                        if (api.events.balances.Transfer.is(event)) {
                            const [from, to, amount] = event.data;
                            console.log(`Transferred ${amount.toNumber() / 1e12} tokens from ${from.toString()} to ${to.toString()}`);
                        }
                    });
                    console.log("All transfers completed successfully");
                    resolve();
                }
            })
            .catch(reject);
    });

    //1. Create a subscription tier 
    let create_subscription_call = api.tx.subscriptions.createSubscriptionTier({
        includedCtNumber: 100,
        includedCtActionsNumber: 100,
        price: 10,
        payOnDemand: {
            extraCtPrice: 0,
            extraCtActionPrice: 0
        },
        includedAnonymousTransfers: 100,
        subscriptionBillingPeriodLength: 100,
        securedBillingPeriodsNumber: 100,
    });

    let create_subscription_call_sudo = api.tx.sudo.sudo(create_subscription_call);
    await create_subscription_call_sudo
        .signAndSend(sudoAccount)
        .then(() => {
            console.log("Subscription tier created");
        }).catch((err) => {
            console.log(err);
            console.log("Test failed : subscription creation failed!");
            process.exit(1);
        });;

    // wait for tx to propogate
    await new Promise(resolve => setTimeout(resolve, 6000));

    // transfer tokens to the subscription pallet
    // we need to do this because the subscription pallet is not a user account and needs ED before it can receive subscription payments
    const transfer_to_subscription_call = api.tx.balances.transferKeepAlive(process.env.SUBSCRIPTION_PALLET_ADDRESS, "10000000000000");
    await transfer_to_subscription_call
        .signAndSend(sudoAccount)
        .then(() => {
            console.log("Tokens transferred to subscription pallet");
        }).catch((err) => {
            console.log(err);
            console.log("Test failed : transfer to subscription pallet failed!");
            process.exit(1);
        });

    // wait for tx to propogate
    await new Promise(resolve => setTimeout(resolve, 6000));

    // 2. Create an app-agent for all three owners
    const appAgentOwners = [appAgentOne, appAgentTwo, appAgentThree];
    const createAppAgentPromises = appAgentOwners.map((owner) => {
        return new Promise((resolve, reject) => {
            api.tx.appAgents
                .createAppAgent()
                .signAndSend(owner, ({ status, events }) => {
                    if (status.isInBlock || status.isFinalized) {
                        events.forEach(({ event }) => {
                            if (api.events.appAgents.AppAgentCreated.is(event)) {
                                const [appAgentId, ownerAddress] = event.data;
                                console.log(`App agent created: ID ${appAgentId.toString()} for owner ${ownerAddress.toString()}`);
                            }
                        });
                        resolve();
                    }
                })
                .catch(reject);
        });
    });

    try {
        await Promise.all(createAppAgentPromises);
        console.log("All app agents created successfully");
    } catch (err) {
        console.error("App agent creation failed:", err);
        process.exit(1);
    }

    await create_app_agent_assets(api, appAgentOne, 1000, demo_user_one, demo_user_two);
    await create_app_agent_assets(api, appAgentTwo, 1000, demo_user_three, demo_user_one);
    await create_app_agent_assets(api, appAgentThree, 1000, demo_user_two, demo_user_three);

    await create_app_agent_nfts(api, appAgentOne, 1000, demo_user_one);
    await create_app_agent_nfts(api, appAgentTwo, 1000, demo_user_three);
    await create_app_agent_nfts(api, appAgentThree, 1000, demo_user_two);
}

async function create_app_agent_assets(api, appAgentOwner, appAgentId, token_recipient, token_recipient_two) {
    // Generate a random ID between 1 and 1,000,000
    const id = Math.floor(Math.random() * 1000000) + 1;

    let asset_admin = encodeNamed(appAgentId, "asset-admi");

    let create_fungible_token = api.tx.assets.create(
        id,
        asset_admin,
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

    await create_fungible_token_ct.signAndSend(appAgentOwner)
        .then(() => {
            console.log("Fungible token created");
        }).catch((err) => {
            console.log(err);
            console.log("Test failed : fungible token creation failed!");
            process.exit(1);
        });

    await new Promise(resolve => setTimeout(resolve, 6000));

    // mint tokens to the app agent
    const mint_tokens_call = api.tx.assets.mint(
        id,
        token_recipient.address,
        1000
    );

    let mint_tokens_ct = api.tx.addressPools.submitClearingTransaction(
        appAgentId,
        [[
            [
                { AppAgentId: appAgentId },
                mint_tokens_call
            ]
        ]]
    );

    await mint_tokens_ct.signAndSend(appAgentOwner)
        .then(() => {
            console.log("Tokens minted to app agent");
        }).catch((err) => {
            console.log(err);
            console.log("Test failed : mint tokens to app agent failed!");
            process.exit(1);
        });

    // generate a free transfer
    let free_transfer_call = api.tx.player_transfers.submit_transfer_assets(
        id,
        token_recipient_two.address,
        10
    );

    free_transfer_call.signAndSend(token_recipient)
        .then(() => {
            console.log("Free transfer created");
        }).catch((err) => {
            console.log(err);
            console.log("Test failed : free transfer creation failed!");
            process.exit(1);
        });

    await new Promise(resolve => setTimeout(resolve, 6000));

    console.log("App agent assets created successfully");

}

async function create_app_agent_nfts(api, appAgentOwner, appAgentId, nft_recipient) {
    // Generate a random ID between 1 and 1,000,000
    const collection_id = Math.floor(Math.random() * 1000000) + 1;
    const item_id = Math.floor(Math.random() * 1000000) + 1;

    let create_nft_call = api.tx.nfts.create(
        collection_id,
        appAgentOwner.address,
        1
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

    await create_nft_ct.signAndSend(appAgentOwner)
        .then(() => {
            console.log("NFT created");
        }).catch((err) => {
            console.log(err);
            console.log("Test failed : NFT creation failed!");
            process.exit(1);
        });

    await new Promise(resolve => setTimeout(resolve, 6000));

    // mint nfts to the nft recipient
    const mint_nfts_call = api.tx.nfts.mint(
        collection_id,
        item_id,
        nft_recipient.address,
        null
    );

    let mint_nfts_ct = api.tx.addressPools.submitClearingTransaction(
        appAgentId,
        [[
            [
                { AppAgentId: appAgentId },
                mint_nfts_call
            ]
        ]]
    );

    await mint_nfts_ct.signAndSend(appAgentOwner)
        .then(() => {
            console.log("NFTs minted to app agent");
        }).catch((err) => {
            console.log(err);
            console.log("Test failed : mint NFTs to app agent failed!");
            process.exit(1);
        });

    console.log("App agent NFTs created successfully");

}

main()
    .catch(console.error)
    .finally(() => process.exit());
