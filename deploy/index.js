const { ApiPromise, WsProvider } = require("@polkadot/api");
const { Keyring } = require("@polkadot/keyring");
const dotenv = require("dotenv");
const fs = require('fs');
const path = require('path');
const { create_app_agent } = require('./utils/app_agent');
const { create_fungible_token } = require('./utils/fungible');
const { create_nft_collection, create_nft_token } = require('./utils/nft');

const aws_s3_assets_path = path.join(__dirname, '..', 'aws_s3_assets');
const game_a_path = path.join(aws_s3_assets_path, 'game-a/');
const game_b_path = path.join(aws_s3_assets_path, 'game-b/');
const game_c_path = path.join(aws_s3_assets_path, 'game-c/');

const game_folders = [game_a_path, game_b_path, game_c_path];

dotenv.config();

async function main() {
    console.log("Read WS_PROVIDER_URL from .env file");
    const wsProviderUrl = process.env.WS_PROVIDER_URL;
    if (!wsProviderUrl) {
        throw new Error("WS_PROVIDER_URL is not set in the .env file");
    }

    console.log("Create a provider with the URL from .env");
    const provider = new WsProvider(wsProviderUrl);

    console.log("Instantiate the API with the provider");
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

    console.log("Construct the keyring");
    const keyring = new Keyring({ type: "sr25519" });

    console.log("Load accounts from .env file");
    const faucetAccount = keyring.addFromUri(process.env.FAUCET_ACCOUNT_MNEMONIC);
    const appAgentOneOwner = keyring.addFromUri(process.env.APP_AGENT_OWNER_ONE_MNEMONIC);
    const appAgentTwoOwner = keyring.addFromUri(process.env.APP_AGENT_OWNER_TWO_MNEMONIC);
    const appAgentThreeOwner = keyring.addFromUri(process.env.APP_AGENT_OWNER_THREE_MNEMONIC);
    const appAgentOwners = [appAgentOneOwner, appAgentTwoOwner, appAgentThreeOwner];

    const demo_user_one = keyring.addFromUri(process.env.DEMO_ACCOUNT_ONE_MNEMONIC);
    const demo_user_two = keyring.addFromUri(process.env.DEMO_ACCOUNT_TWO_MNEMONIC);
    const demo_user_three = keyring.addFromUri(process.env.DEMO_ACCOUNT_THREE_MNEMONIC);

    const transferAmount = parseInt(process.env.TRANSFER_AMOUNT) * 1e12;

    console.log("Start to initialise the owners of the app agents");
    console.log("Create a batch of transfers");
    const transfers = [
        api.tx.balances.transferKeepAlive(appAgentOneOwner.address, transferAmount.toString()),
        api.tx.balances.transferKeepAlive(appAgentTwoOwner.address, transferAmount.toString()),
        api.tx.balances.transferKeepAlive(appAgentThreeOwner.address, transferAmount.toString())
    ];

    console.log("Send the batch of transfers");
    await new Promise(async (resolve, reject) => {
        const unsubscribe = await api.tx.utility
            .batchAll(transfers)
            .signAndSend(faucetAccount, ({ status, events }) => {
                if (status.isFinalized) {
                    events.forEach(({ event }) => {
                        if (api.events.balances.Transfer.is(event)) {
                            const [from, to, amount] = event.data;
                            console.log(`Transferred ${amount.toNumber() / 1e12} tokens from ${from.toString()} to ${to.toString()}`);
                        }
                    });
                    console.log("Initial transfers completed successfully");
                    unsubscribe();
                    resolve();
                }
            })
            .catch(reject);
    });

    console.log("Traverse the game folders and create app-agents and assets for each game");
    for (const [game_index, game_folder] of game_folders.entries()) {
        console.log("Game folder:", game_folder);
        let appagentId = null;
        let appAgentOwner = appAgentOwners[game_index];

        const subFolders = fs.readdirSync(game_folder);

        for (const subFolder of subFolders) {
            if (subFolder.startsWith('app-agent-')) {
                const appAgentPath = path.join(game_folder, subFolder);
                console.log("AppAgent folder detected:", appAgentPath);

                let metadataUrl = getObjectMetadataURL(appAgentPath);
                if (!metadataUrl) {
                    throw new Error(`Could not find metadata URL in ${appAgentPath}`);
                }
                console.log("AppAgent metadata URL:", metadataUrl);

                appagentId = await create_app_agent(api, appAgentOwner, metadataUrl);
            }

            else if (subFolder.startsWith('fungible-')) {
                const fungiblePath = path.join(game_folder, subFolder);
                console.log("Fungible token folder detected:", fungiblePath);

                let metadataUrl = getObjectMetadataURL(fungiblePath);
                if (!metadataUrl) {
                    throw new Error(`Could not find metadata URL in ${fungiblePath}`);
                }
                console.log("Fungible token metadata URL:", metadataUrl);

                create_fungible_token(api, appAgentOwner, appagentId, demo_user_one, demo_user_two, metadataUrl);
            }

            else if (subFolder.startsWith('nft-collection')) {
                const folderPath = path.join(game_folder, subFolder);
                console.log("NFT collection root folder detected:", folderPath);

                const subsubFolders = fs.readdirSync(folderPath);

                let collection_id = null;

                for (const subsubFolder of subsubFolders) {
                    if (subsubFolder.startsWith('nft-collection')) {
                        const nftCollectionPath = path.join(folderPath, subsubFolder);
                        console.log("NFT collection folder detected:", nftCollectionPath);

                        let metadataUrl = getObjectMetadataURL(nftCollectionPath);
                        if (!metadataUrl) {
                            throw new Error(`Could not find metadata URL in ${nftCollectionPath}`);
                        }
                        console.log("NFT collection metadata URL:", metadataUrl);

                        collection_id = await create_nft_collection(api, appAgentOwner, appagentId, metadataUrl);
                    }

                    else if (subsubFolder.startsWith('nft-token')) {
                        const nftTokenPath = path.join(folderPath, subsubFolder);
                        console.log("NFT token folder detected:", nftTokenPath);

                        let metadataUrl = getObjectMetadataURL(nftTokenPath);
                        if (!metadataUrl) {
                            throw new Error(`Could not find metadata URL in ${nftTokenPath}`);
                        }
                        console.log("NFT token metadata URL:", metadataUrl);

                        await create_nft_token(api, appAgentOwner, appagentId, collection_id, metadataUrl, demo_user_one, demo_user_three);
                    }
                }
            }

            else {
                console.log("Unknown folder detected, ignoring: ", subFolder);
            }
        }
    }
}

/**
 * Function searches for the json file with object metadata.
 * And calculates the metadata URL based on the file path.
 *
 * @param {string} directory - The directory where the metadata file is stored.
 * @return {string|null} The metadata URL if found, otherwise null.
 */
function getObjectMetadataURL(directory) {
    const files = fs.readdirSync(directory);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    for (const file of jsonFiles) {
        const filePath = path.join(directory, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
            // console.log(`File: ${filePath}`);

            const relativePath = path.relative(aws_s3_assets_path, filePath);
            const url = `https://trait-wallet-demo-account.trait.tech/${relativePath.replace(/\\/g, '/')}`;

            console.log(`Generated URL: ${url}`);
            return url;
        }
    }

    return null;
}

main()
    .catch(console.error)
    .finally(() => process.exit());
