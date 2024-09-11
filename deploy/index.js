const { ApiPromise, WsProvider } = require("@polkadot/api");
const { Keyring } = require("@polkadot/keyring");
const { encodeNamed } = require("./keyless");
const dotenv = require("dotenv");
const fs = require('fs');
const path = require('path');

const aws_s3_assets_path = path.join(__dirname, '..', 'aws_s3_assets');
const game_a_path = path.join(aws_s3_assets_path, 'game-a/');
const game_b_path = path.join(aws_s3_assets_path, 'game-b/');
const game_c_path = path.join(aws_s3_assets_path, 'game-c/');

const game_folders = [game_a_path, game_b_path, game_c_path];

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
                    console.log("Initial transfers completed successfully");
                    resolve();
                }
            })
            .catch(reject);
    });

    // 2. Create an app-agent for all three owners
    const appAgentOwners = [appAgentOne, appAgentTwo, appAgentThree];
    let appAgents = {};
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
                                // save the app agent id to the appAgents object
                                appAgents[appAgentId.toString()] = owner;
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
        console.log("appAgents:", appAgents);
    } catch (err) {
        console.error("App agent creation failed:", err);
        process.exit(1);
    }

    for (const [index, appagentid] of Object.keys(appAgents).entries()) {

        // setup metadata for the app agent
        await setup_metadata(index, api, appagentid, appAgents[appagentid]);

        console.log("creating app agent assets for appagent:", appagentid);
        await create_app_agent_assets(api, appAgents[appagentid], appagentid, demo_user_one, demo_user_two);
    }

    // await create_app_agent_assets(api, appAgentOne, 1000, demo_user_one, demo_user_two);
    // await create_app_agent_assets(api, appAgentTwo, 1001, demo_user_three, demo_user_one);
    // await create_app_agent_assets(api, appAgentThree, 1002, demo_user_two, demo_user_three);

    // await create_app_agent_nfts(api, appAgentOne, 1000, demo_user_one, demo_user_two);
    // await create_app_agent_nfts(api, appAgentTwo, 1001, demo_user_three, demo_user_one);
    // await create_app_agent_nfts(api, appAgentThree, 1002, demo_user_two, demo_user_three);
}

async function setup_metadata(index, api, appAgentId, appAgentOwner) {
    // setup metadata for the app agent
    let folder_path = game_folders[index];
    console.log("folder_path:", folder_path);

    // Search for folders starting with app-agent- and print all files
    const folders = fs.readdirSync(folder_path);

    folders.forEach(folder => {
        if (folder.startsWith('app-agent-')) {
            const folderPath = path.join(folder_path, folder);
            let metadata = readFilesInDirectory(folderPath);

            console.log("metadata:", metadata);

            if (metadata) {
                // create the transaction to set the metadata
                let set_metadata_tx = api.tx.appAgents.setAppAgentMetadata(
                    appAgentId,
                    metadata
                );

                // sign and send the transaction
                set_metadata_tx.signAndSend(appAgentOwner)
                    .then(() => {
                        console.log("Metadata set successfully");
                    })
                    .catch(err => {
                        console.error("Error setting metadata:", err);
                    });
            } else {
                console.log("No metadata found in the directory");
            }
        }
    });

}

// Function to read all files in a directory
function readFilesInDirectory(directory) {
    const files = fs.readdirSync(directory);
    // Filter files to only include those ending with .json
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    // Return the content of the first JSON file found
    for (const file of jsonFiles) {
        const filePath = path.join(directory, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
            console.log(`File: ${filePath}`);
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        }
    }

    // If no JSON file is found, return null or an empty object
    return null;
}

async function create_app_agent_assets(api, appAgentOwner, appAgentId, token_recipient, token_recipient_two) {
    let asset_admin = encodeNamed(appAgentId, "asset-admi");

    let create_fungible_token = api.tx.assets.create(
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

    // Wait for the event and get the asset ID
    let asset_id;
    await create_fungible_token_ct.signAndSend(appAgentOwner, ({ events = [], status }) => {
        if (status.isInBlock || status.isFinalized) {
            events.forEach(({ event: { data, method, section } }) => {
                if (section === 'assets' && method === 'Created') {
                    const assetId = data[0].toString();
                    console.log(`Asset created with ID: ${assetId}`);
                    asset_id = assetId;
                }
            });
        }
    }).catch((error) => {
        console.error("Error creating fungible token:", error);
    });

    await new Promise(resolve => setTimeout(resolve, 6000)); // wait for the previous tx to propogate

    // mint tokens to the app agent
    const mint_tokens_call = api.tx.assets.mint(
        asset_id,
        token_recipient.address,
        1000
    );

    let mint_tokens_ct = api.tx.addressPools.submitClearingTransaction(
        appAgentId,
        [[
            [
                { NamedAddress: asset_admin },
                mint_tokens_call
            ]
        ]]
    );

    let batch_calls = [
        create_fungible_token_ct,
        mint_tokens_ct
    ];

    let batch_call = api.tx.utility.batch(batch_calls);

    await new Promise(resolve => setTimeout(resolve, 6000)); // wait for the previous tx to propogate

    await batch_call.signAndSend(appAgentOwner)
        .then(() => {
            console.log("Tokens minted");
        }).catch((err) => {
            console.log(err);
            console.log("Test failed : token minting failed!");
            process.exit(1);
        });


    // generate 5 free transfers between the two users
    let batch_calls_two = [];
    for (let i = 0; i < 5; i++) {
        let free_transfer_call = api.tx.playerTransfers.submitTransferAssets(
            asset_id,
            token_recipient_two.address,
            10
        );

        batch_calls_two.push(free_transfer_call);
    }

    let batch_call_two = api.tx.utility.batch(batch_calls_two);

    batch_call_two.signAndSend(token_recipient)
        .then(() => {
            console.log(`Free transfer created`);
        }).catch((err) => {
            console.log(err);
            console.log(`Test failed : free transfer creation failed!`);
            process.exit(1);
        });

    // Add a small delay between transfers
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("App agent assets created successfully");
}

async function create_app_agent_nfts(api, appAgentOwner, appAgentId, nft_recipient, nft_recipient_two) {
    // Generate a random ID between 1 and 1,000,000
    const collection_id = Math.floor(Math.random() * 1000000) + 1;
    const item_id = Math.floor(Math.random() * 1000000) + 1;

    let asset_admin = encodeNamed(appAgentId, "asset-admi");

    let create_nft_call = api.tx.nfts.create(
        collection_id,
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

    await create_nft_ct.signAndSend(appAgentOwner)
        .then(() => {
            console.log("NFT created");
        }).catch((err) => {
            console.log(err);
            console.log("Test failed : NFT creation failed!");
            process.exit(1);
        });

    await new Promise(resolve => setTimeout(resolve, 6000)); // wait for the previous tx to propogate

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
                { NamedAddress: asset_admin },
                mint_nfts_call
            ]
        ]]
    );

    await mint_nfts_ct.signAndSend(appAgentOwner)
        .then(() => {
            console.log("NFTs minted");
        }).catch((err) => {
            console.log(err);
            console.log("Test failed : NFT minting failed!");
            process.exit(1);
        });

    await new Promise(resolve => setTimeout(resolve, 6000)); // wait for the previous tx to propogate


    // create 5 transfers of the nft to the nft recipient
    let batch_calls_two = [];
    for (let i = 0; i < 5; i++) {
        let transfer_nft_call = api.tx.nfts.transfer(
            collection_id,
            item_id,
            nft_recipient_two.address
        );

        batch_calls_two.push(transfer_nft_call);
    }

    let batch_call_two = api.tx.utility.batch(batch_calls_two);

    batch_call_two.signAndSend(nft_recipient)
        .then(() => {
            console.log("Batch call sent");
        });

    console.log("App agent NFTs created successfully");
}

main()
    .catch(console.error)
    .finally(() => process.exit());
