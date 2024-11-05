import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import dotenv from "dotenv";
import path from "path";
import Pino from "pino";
import { fileURLToPath } from "url";
import { collectGameData } from "./utils/game_data.js";
import {
  init_blockchain_accounts,
  createBlockchainAssets,
  create_demo_fungible_transfers,
  create_demo_nft_transfers,
} from "./utils/deploy_actions.js";

const logger = Pino();
const startTime = Date.now();

// Environment vars
dotenv.config();

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} is not set`);
  return value;
}

// Path where to find game data
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aws_s3_assets_path = path.join(__dirname, "../..", "aws_s3_assets");
const game_a_path = path.join(aws_s3_assets_path, "game-a/");
const game_b_path = path.join(aws_s3_assets_path, "game-b/");
const game_c_path = path.join(aws_s3_assets_path, "game-c/");
const game_folders = [game_a_path, game_b_path, game_c_path];

// Main func to deploy blockchain assets
async function main(): Promise<void> {
  logger.info("Read WS_PROVIDER_URL from .env file");
  const wsProviderUrl = process.env.WS_PROVIDER_URL;
  if (!wsProviderUrl) {
    throw new Error("WS_PROVIDER_URL is not set in the .env file");
  }

  logger.info("Create a provider with the URL from .env");
  const provider = new WsProvider(wsProviderUrl);

  logger.info("Instantiate the API with the provider");
  const api = await ApiPromise.create({
    provider,
    types: {
      TraitPrimitivesAppAgentCtActionOrigin: {
        _enum: {
          AppAgentId: "u32",
          AppAgentAddress: "AccountId",
          TransactionalAddressId: "u32",
          TransactionalAddress: "AccountId",
          NamedAddress: "AccountId",
          NamedAddressName: "Vec<u8>",
        },
      },
    },
  });

  logger.info("Construct the keyring");
  const keyring = new Keyring({ type: "sr25519" });

  logger.info("Load accounts from .env file");
  const faucetAccount = keyring.addFromUri(getEnvVar("FAUCET_ACCOUNT_MNEMONIC"));
  const appAgentOneOwner = keyring.addFromUri(getEnvVar("APP_AGENT_OWNER_ONE_MNEMONIC"));
  const appAgentTwoOwner = keyring.addFromUri(getEnvVar("APP_AGENT_OWNER_TWO_MNEMONIC"));
  const appAgentThreeOwner = keyring.addFromUri(getEnvVar("APP_AGENT_OWNER_THREE_MNEMONIC"));
  const appAgentOwners = [appAgentOneOwner, appAgentTwoOwner, appAgentThreeOwner];

  const demo_user_one = keyring.addFromUri(getEnvVar("DEMO_ACCOUNT_ONE_MNEMONIC"));
  const demo_user_two = keyring.addFromUri(getEnvVar("DEMO_ACCOUNT_TWO_MNEMONIC"));
  const demo_user_three = keyring.addFromUri(getEnvVar("DEMO_ACCOUNT_THREE_MNEMONIC"));
  const demoAccounts = [demo_user_one, demo_user_two, demo_user_three];

  // get amount of transfers
  const appAgentOwnerTransferAmount = parseInt(getEnvVar("APP_AGENT_OWNER_TRANSFER_AMOUNT")) * 1e12;
  const demoAccTransferAmount = parseInt(getEnvVar("DEMO_ACCOUNT_TRANSFER_AMOUNT")) * 1e12;

  // init blockchain accounts
  await init_blockchain_accounts(
    api,
    faucetAccount,
    appAgentOwners,
    demoAccounts,
    appAgentOwnerTransferAmount,
    demoAccTransferAmount,
  );

  const gameDataList = collectGameData(game_folders, appAgentOwners, aws_s3_assets_path);

  await createBlockchainAssets(api, gameDataList, demo_user_one);

  await create_demo_fungible_transfers(api, gameDataList, demo_user_one, demo_user_two, demo_user_three);

  await create_demo_nft_transfers(api, gameDataList, demo_user_one, demo_user_two, demo_user_three);
}

// Logging wrapper
main()
  .catch(logger.error)
  .finally(() => {
    const endTime = Date.now();
    const executionTime = (endTime - startTime) / 1000; // Convert to seconds
    logger.info(`Total execution time: ${executionTime.toFixed(2)} seconds`);
    process.exit();
  });
