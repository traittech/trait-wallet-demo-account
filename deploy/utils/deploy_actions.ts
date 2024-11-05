import { ApiPromise } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";
import Pino from "pino";
import { create_app_agent } from "./app_agent.js";
import {
  create_fungible_tokens,
  create_token_transfer,
  set_metadata_and_mint_fungible_token,
} from "./fungible.js";
import {
  create_nft_collections,
  create_nft_transfers,
  set_metadata_and_mint_nft,
} from "./nft.js";
import { GameData } from "./types";
import {
  processSignedBatchTransaction,
  processSignedTransaction,
} from "./utils.js";

const logger = Pino();

async function init_blockchain_accounts(
  api: ApiPromise,
  faucetAccount: KeyringPair,
  appAgentOwners: KeyringPair[],
  demoAccounts: KeyringPair[],
  appAgentOwnerTransferAmount: number,
  demoAccTransferAmount: number,
): Promise<void> {
  logger.info("Initialise the owners of the app agents and demo accounts");

  // build the list of transfers
  const transfers = [];
  for (const appAgentOwner of appAgentOwners) {
    transfers.push(
      api.tx.balances.transferKeepAlive(
        appAgentOwner.address,
        appAgentOwnerTransferAmount.toString()
      )
    );
  }
  for (const demoAccount of demoAccounts) {
    transfers.push(
      api.tx.balances.transferKeepAlive(
        demoAccount.address,
        demoAccTransferAmount.toString()
      )
    );
  }

  // Send the batch of transfers
  await processSignedBatchTransaction(
    faucetAccount,
    api.tx.utility.batchAll(transfers)
  );
}

async function createBlockchainAssets(
  api: ApiPromise,
  gameDataList: GameData[],
  demo_user_one: KeyringPair,
): Promise<void> {
  logger.info("Starting to create blockchain assets for the games");
  for (const [gameIndex, gameData] of gameDataList.entries()) {
    logger.info(`Processing game ${gameIndex + 1}`);
    const appAgentOwner = gameData.appAgent.appAgentOwner;

    // Create app agent and set metadata
    logger.info(`Creating app agent for game ${gameIndex + 1}`);
    const appAgentId = await create_app_agent(
      api,
      appAgentOwner,
      gameData.appAgent?.metadataUrl
    );
    logger.info(`App agent created for game ${gameIndex + 1}: ${appAgentId}`);

    // Create and configure fungible tokens
    if (gameData.fungibles.length > 0) {
      logger.info(`Creating fungible tokens for game ${gameIndex + 1}`);
      await create_fungible_tokens(
        api,
        appAgentOwner,
        appAgentId,
        gameData.fungibles,
      );
      logger.info(`Fungible tokens created for game ${gameIndex + 1}`);
      logger.info(
        `Setting metadata and minting fungible tokens of game ${gameIndex + 1}`
      );
      await set_metadata_and_mint_fungible_token(
        api,
        appAgentOwner,
        appAgentId,
        gameData.fungibles,
        demo_user_one
      );
      logger.info(
        `Fungible tokens created and configured for game ${gameIndex + 1}`
      );
    }

    // Create and configure NFT collections and tokens
    logger.info(`Creating NFT collections for game ${gameIndex + 1}`);
    await create_nft_collections(
      api,
      appAgentOwner,
      appAgentId,
      gameData.nftCollections
    );
    logger.info(`NFT collections created for game ${gameIndex + 1}`);

    for (const nftCollection of gameData.nftCollections) {
      logger.info(
        `Setting metadata and minting NFTs for collection ${
          nftCollection.collectionId
        } of game ${gameIndex + 1}`
      );
      await set_metadata_and_mint_nft(
        api,
        appAgentOwner,
        appAgentId,
        nftCollection,
        demo_user_one.address
      );
      logger.info(
        `Successfully configured the NFT collection ${
          nftCollection.collectionId
        } of game ${gameIndex + 1}`
      );
    }
    logger.info(
      `NFT collections created and configured for game ${gameIndex + 1}`
    );
  }

  logger.info("All games processed");
  logger.info(
    gameDataList
      .map((f) => f.fungibles)
      .flat()
      .map((f) => f.tokenId),
    "Fungibles"
  );
  logger.info(
    gameDataList
      .map((f) => f.nftCollections)
      .flat()
      .map((f) => f.collectionId),
    "Collections"
  );
}

async function create_demo_fungible_transfers(
  api: ApiPromise,
  gameDataList: GameData[],
  demo_user_one: KeyringPair,
  demo_user_two: KeyringPair,
  demo_user_three: KeyringPair,
): Promise<void> {
  logger.info("Create demo transfers for fungibles");
  for (const fungibleInfo of gameDataList.map((f) => f.fungibles).flat()) {
    await create_token_transfer(
      api,
      fungibleInfo,
      demo_user_one,
      [demo_user_two, demo_user_three],
      400
    );
    await create_token_transfer(
      api,
      fungibleInfo,
      demo_user_two,
      [demo_user_one, demo_user_three],
      200
    );
    await create_token_transfer(
      api,
      fungibleInfo,
      demo_user_three,
      [demo_user_one, demo_user_two],
      100
    );
  }
}

async function create_demo_nft_transfers(
  api: ApiPromise,
  gameDataList: GameData[],
  demo_user_one: KeyringPair,
  demo_user_two: KeyringPair,
  demo_user_three: KeyringPair,
): Promise<void> {
  logger.info("Create demo transfers for NFTs");
  for (const collectionInfo of gameDataList.map((f) => f.nftCollections).flat()) {
    const recipient = Math.random() < 0.5 ? demo_user_three : demo_user_two;
    for (const nftTokenInfo of collectionInfo.nftTokens) {
      if (typeof nftTokenInfo.collectionId === 'undefined' || nftTokenInfo.collectionId === null) {
        throw new Error(`Unknown NFT collection ID: ${collectionInfo}`);
      }
      if (typeof nftTokenInfo.tokenId === 'undefined' || nftTokenInfo.tokenId === null) {
        throw new Error(`Unknown NFT Token ID: ${collectionInfo}`);
      }
      await create_nft_transfers(
        api,
        nftTokenInfo.collectionId,
        nftTokenInfo.tokenId,
        demo_user_one,
        recipient
      );
    }
  }
}

async function create_demo_balance_transfers(
  api: ApiPromise,
  token_recipient: KeyringPair,
  token_recipient_two: KeyringPair
): Promise<void> {
  logger.info("Generate free transfers between the two users");

  for (let i = 0; i < 2; i++) {
    const tx = api.tx.playerTransfers.submitTransferBalances(
      token_recipient_two.address,
      1000000
    );
    await processSignedTransaction(token_recipient, tx);
  }
  logger.info(`Free transfer created and confirmed`);
}

export {
    init_blockchain_accounts,
    createBlockchainAssets,
    create_demo_fungible_transfers,
    create_demo_nft_transfers,
    create_demo_balance_transfers,
  };
