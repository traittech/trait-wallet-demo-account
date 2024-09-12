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
    const sudoAccount = keyring.addFromUri(process.env.SUDO_ACCOUNT_MNEMONIC);  // TODO let's rename to faucetAccount
    const appAgentOne = keyring.addFromUri(process.env.APP_AGENT_OWNER_ONE_MNEMONIC);
    const appAgentTwo = keyring.addFromUri(process.env.APP_AGENT_OWNER_TWO_MNEMONIC);
    const appAgentThree = keyring.addFromUri(process.env.APP_AGENT_OWNER_THREE_MNEMONIC);
    const appAgentOwners = [appAgentOne, appAgentTwo, appAgentThree];

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

    // traverse the game folders and create app-agents and assets for each game
    for (const [index, folder] of game_folders.entries()) {
        console.log("folder:", folder);
        let appagentId = null;
        let appAgentOwner = appAgentOwners[index];

        // Search for folders starting with app-agent- and print all files
        const subFolders = fs.readdirSync(folder);

        for (const subFolder of subFolders) {
            console.log("subFolder:", subFolder);
            if (subFolder.startsWith('app-agent-')) {
                const folderPath = path.join(folder, subFolder);
                console.log("folderPath:", folderPath);

                let metadataUrl = readFilesInDirectory(folderPath);
                console.log("metadataUrl:", metadataUrl);

                // TODO let's extract code to create AppAgent and set its metadata into a separate function
                if (metadataUrl) {
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

                    await new Promise(resolve => setTimeout(resolve, 10_000)); // wait for the previous tx to propogate
                }
            }

            else if (subFolder.startsWith('fungible-')) {
                console.log("fungible-token folder detected");
                const folderPath = path.join(folder, subFolder);
                console.log("folderPath:", folderPath);

                let metadataUrl = readFilesInDirectory(folderPath);
                console.log("metadataUrl:", metadataUrl);
                create_app_agent_fungible_token(api, appAgentOwner, appagentId, demo_user_one, demo_user_two, metadataUrl);

                await new Promise(resolve => setTimeout(resolve, 10_000)); // wait for the previous tx to propogate
            }

            if (subFolder.startsWith('nft-collection')) {
                console.log("nft-collection folder detected");
                const folderPath = path.join(folder, subFolder);
                console.log("folderPath:", folderPath);

                const subsubFolders = fs.readdirSync(folderPath);

                let collection_id = null;

                for (const subsubFolder of subsubFolders) {
                    if (subsubFolder.startsWith('nft-collection')) {
                        const nftCollectionPath = path.join(folderPath, subsubFolder);
                        console.log("nftCollectionPath:", nftCollectionPath);
                        let metadataUrl = readFilesInDirectory(nftCollectionPath);
                        console.log("metadataUrl:", metadataUrl);

                        collection_id = await create_app_agent_nft_collection(api, appAgentOwner, appagentId, metadataUrl);
                    }

                    else if (subsubFolder.startsWith('nft-token')) {
                        const nftItemPath = path.join(folderPath, subsubFolder);
                        console.log("nftItemPath:", nftItemPath);
                        let metadataUrl = readFilesInDirectory(nftItemPath);
                        console.log("metadataUrl:", metadataUrl);

                        await create_app_agent_nft_token(api, appAgentOwner, appagentId, collection_id, metadataUrl, demo_user_one, demo_user_three);
                    }
                }


            }

            else {
                console.log("unknown folder detected, ignoring...");
            }
        }
    }
}

// Function to read all files in a directory
function readFilesInDirectory(directory) {
    const files = fs.readdirSync(directory);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    for (const file of jsonFiles) {
        const filePath = path.join(directory, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
            console.log(`File: ${filePath}`);

            // Generate the URL based on the folder structure
            const relativePath = path.relative(aws_s3_assets_path, filePath);
            const url = `https://trait-wallet-demo-account.trait.tech/${relativePath.replace(/\\/g, '/')}`;

            console.log(`Generated URL: ${url}`);

            // Return the URL instead of reading the file content
            return url;
        }
    }

    return null;
}

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
    await create_fungible_token_ct.signAndSend(appAgentOwner, ({ events = [], status }) => {
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

    await new Promise(resolve => setTimeout(resolve, 10_000)); // wait for the previous tx to propogate

    // mint tokens to the app agent
    const mint_tokens_call = api.tx.assets.mint(
        token_id,
        token_recipient.address,
        1000
    );

    let mint_tokens_ct = api.tx.addressPools.submitClearingTransaction(
        appAgentId,
        [[
            [
                { NamedAddress: token_admin },
                mint_tokens_call
            ]
        ]]
    );

    let set_metadata_call = api.tx.assets.setMetadata(
        token_id,
        metadataUrl
    );

    let set_metadata_ct = api.tx.addressPools.submitClearingTransaction(
        appAgentId,
        [[
            [
                { NamedAddress: token_admin },
                set_metadata_call
            ]
        ]]
    );

    // TODO we can put mint_tokens_call & set_metadata_call into a single CT and avoid using batch_all

    let batch_calls = [
        create_fungible_token_ct,
        mint_tokens_ct,
        set_metadata_ct
    ];

    let batch_call = api.tx.utility.batch(batch_calls);

    await new Promise(resolve => setTimeout(resolve, 10000)); // wait for the previous tx to propogate

    await batch_call.signAndSend(appAgentOwner)
        .then(() => {
            console.log(`Fungible token ${token_id} configured.`);
        }).catch((err) => {
            console.log(err);
            console.log(`Test failed : couldn't configure fungible token ${token_id}!`);
            process.exit(1);
        });

    // TODO let's split this into two functions
    // this is the end of the fungible token creation, return the token ID to the caller
    // below is another function to create transfers


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

async function create_app_agent_nft_collection(api, appAgentOwner, appAgentId) {
    let asset_admin = encodeNamed(appAgentId, "asset-admi");

    // send some balance to admin
    let balance_call = api.tx.balances.transferKeepAlive(
        asset_admin,
        10
    );

    await balance_call.signAndSend(appAgentOwner);

    await new Promise(resolve => setTimeout(resolve, 10_000)); // wait for the previous tx to propogate

    // Create the NFT Collection
    let create_nft_call = api.tx.nfts.create(
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

    await new Promise(resolve => setTimeout(resolve, 10_000)); // wait for the previous tx to propogate

    // Wait for the event and get the collection ID
    let collection_id;
    await new Promise((resolve, reject) => {
        create_nft_ct.signAndSend(appAgentOwner, ({ events = [], status }) => {
            if (status.isInBlock || status.isFinalized) {
                events.forEach(({ event: { data, method, section } }) => {
                    if (section === 'nfts' && method === 'Created') {
                        collection_id = data[0].toString();
                        console.log(`NFT Collection created with ID: ${collection_id}`);
                        resolve();
                    }
                });
            }
        }).catch((error) => {
            console.error("Error creating NFT collection:", error);
            reject(error);
        });
    });

    await new Promise(resolve => setTimeout(resolve, 10_000)); // wait for the previous tx to propogate

    // set the metadata
    let set_team_metadata_call = api.tx.nfts.setTeam(
        collection_id,
        asset_admin,
        asset_admin,
        asset_admin,
    );

    let set_team_metadata_ct = api.tx.addressPools.submitClearingTransaction(
        appAgentId,
        [[
            [
                { NamedAddress: asset_admin },
                set_team_metadata_call
            ]
        ]]
    );

    await set_team_metadata_ct.signAndSend(appAgentOwner)

    // TODO need to set metadata to NFT Collection
    // call to nfts::set_collection_metadata

    console.log("App agent NFTs created successfully");

    return collection_id;
}


async function create_app_agent_nft_token(api, appAgentOwner, appAgentId, collection_id, metadataUrl, recipient_one, recipient_two) {
    let asset_admin = encodeNamed(appAgentId, "asset-admi");

    // Generate a random token ID within a specific range (e.g., 1 to 1000)
    let tokenId = Math.floor(Math.random() * 1000) + 1;

    console.log(`Generated token ID: ${tokenId}`);

    let mint_nft_call = api.tx.nfts.mint(
        collection_id,
        tokenId,
        recipient_one.address,
        {}
    );

    let mint_nft_ct = api.tx.addressPools.submitClearingTransaction(
        appAgentId,
        [[
            [
                { NamedAddress: asset_admin },
                mint_nft_call
            ]
        ]]
    );

    await mint_nft_ct.signAndSend(appAgentOwner);

    await new Promise(resolve => setTimeout(resolve, 10_000)); // wait for the previous tx to propogate

    console.log("App agent NFT token created successfully");

    let set_metadata_call = api.tx.nfts.setMetadata(
        collection_id,
        tokenId,
        metadataUrl
    );

    let set_metadata_ct = api.tx.addressPools.submitClearingTransaction(
        appAgentId,
        [[
            [
                { NamedAddress: asset_admin },
                set_metadata_call
            ]
        ]]
    );

    // TODO We can join mint_nft_call and set_metadata_call into a single atomic in CT
    // It would be faster and natural

    await set_metadata_ct.signAndSend(appAgentOwner);
    await new Promise(resolve => setTimeout(resolve, 10_000)); // wait for the previous tx to propogate

    console.log("App agent NFT metadata set successfully");

    // TODO let's split this into two functions
    // this is the end of the NFT token creation, return the token ID to the caller
    // below is another function to create transfers

    // generate 5 free transfers between the two users
    let batch_calls_two = [];
    for (let i = 0; i < 5; i++) {
        let free_transfer_call = api.tx.playerTransfers.submitTransferAssets(
            asset_id,
            recipient_two.address,
            1
        );
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
}


main()
    .catch(console.error)
    .finally(() => process.exit());
