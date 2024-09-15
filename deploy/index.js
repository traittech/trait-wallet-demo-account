const { ApiPromise, WsProvider } = require("@polkadot/api");
const { Keyring } = require("@polkadot/keyring");
const dotenv = require("dotenv");
const fs = require('fs');
const path = require('path');
const { create_app_agent } = require('./utils/app_agent');
const { create_app_agent_fungible_token } = require('./utils/fungible');
const { create_app_agent_nft_collection } = require('./utils/nft');
const { create_app_agent_nft_token } = require('./utils/nft');

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
    const faucetAccount = keyring.addFromUri(process.env.FAUCET_ACCOUNT_MNEMONIC);
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
            .signAndSend(faucetAccount, ({ status, events }) => {
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

                if (metadataUrl) {
                    appagentId = await create_app_agent(api, appAgentOwner, metadataUrl);
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

main()
    .catch(console.error)
    .finally(() => process.exit());
