import { ApiPromise } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";
import Pino from "pino";
import { FungibleTokenData } from "./types";
import {
  processClearingTransaction,
  processSignedTransaction,
} from "./utils.js";

const logger = Pino();
async function create_fungible_tokens(
  api: ApiPromise,
  appAgentOwner: KeyringPair,
  appAgentId: number,
  fungibleDataList: FungibleTokenData[],
): Promise<void> {
  try {
    logger.info(
      "Start to create " +
      fungibleDataList.length +
        " fungible tokens for the AppAgent ID " +
        appAgentId
    );

    logger.info("Build Clearing transaction to create Fungible tokens");
    const atomics = [];
    for (const tokenDecimals of fungibleDataList.map((f) => f.decimals)) {
      const min_balance = calculateMinBalance(tokenDecimals);
      logger.info(
        "Min balance for token with decimals " +
          tokenDecimals +
          " is " +
          min_balance
      );
      const create_fungible_token_call = api.tx.assets.create(min_balance);
      const create_fungible_token_action = [
        { AppAgentId: appAgentId },
        create_fungible_token_call,
      ];
      const create_fungible_token_atomic = [create_fungible_token_action];
      atomics.push(create_fungible_token_atomic);
    }
    const create_fungible_token_ct =
      api.tx.addressPools.submitClearingTransaction(appAgentId, atomics);

    logger.info(
      "Process clearing transaction and collect IDs of created Fungible tokens."
    );
    const tokenIds: number[] = [];
    const events = await processClearingTransaction(
      appAgentOwner,
      create_fungible_token_ct
    );
    for (const event of events) {
      if (
        event.receipt.event_module === "Assets" &&
        event.receipt.event_name === "Created"
      ) {
        tokenIds.push(parseInt(event.attributes.asset_id.toString()));
      }
    }

    logger.info(`Generated token IDs: ${tokenIds}`);
    if (tokenIds.length != fungibleDataList.length) {
      throw new Error("Not all required fungibles were created");
    }

    logger.info("Save IDs of fungible tokens for later use");
    for (let i = 0; i < tokenIds.length; i++) {
      fungibleDataList[i].tokenId = tokenIds[i];
    }
  } catch (error) {
    logger.error(error, "Error creating fungible tokens");
    throw error;
  }
}

function calculateMinBalance(tokenDecimals: number): number {
  if (tokenDecimals < 3) {
    return 1;
  } else if (tokenDecimals >= 3 && tokenDecimals < 7) {
    return 10 ** (tokenDecimals - 2);
  } else {
    return 10 ** (tokenDecimals - 3);
  }
}

async function set_metadata_and_mint_fungible_token(
  api: ApiPromise,
  appAgentOwner: KeyringPair,
  appAgentId: number,
  fungibleDataList: FungibleTokenData[],
  token_recipient: KeyringPair
): Promise<void> {
  try {
    logger.info(
      "Start to create fungible token for the AppAgent ID " + appAgentId
    );
    logger.info(`Fungibles: ${fungibleDataList}`);

    logger.info("Create atomics to mint and set metadata for each token");
    const atomics = [];
    for (const fungibleData of fungibleDataList) {
      logger.info(`Creating atomic for token ${fungibleData.tokenId}`);
      const mintAmount = 1000 * Math.pow(10, fungibleData.decimals);
      logger.info(`Calculated mint amount: ${mintAmount}`);
      const mint_token_call = api.tx.assets.mint(
        fungibleData.tokenId,
        token_recipient.address,
        mintAmount
      );
      const mint_token_action = [{ AppAgentId: appAgentId }, mint_token_call];
      const set_metadata_call = api.tx.assets.setMetadata(
        fungibleData.tokenId,
        fungibleData.metadataUrl
      );
      const set_metadata_action = [
        { AppAgentId: appAgentId },
        set_metadata_call,
      ];
      const token_atomic = [mint_token_action, set_metadata_action];
      atomics.push(token_atomic);
    }
    logger.info(`Total atomics created: ${atomics.length}`);

    const configure_fungible_ct = api.tx.addressPools.submitClearingTransaction(
      appAgentId,
      atomics
    );
    await processClearingTransaction(appAgentOwner, configure_fungible_ct);
    logger.info("Fungible tokens configured successfully");
  } catch (error) {
    logger.error(error, "Error setting metadata and minting fungible tokens");
    throw error;
  }
}

function calculateTransferAmount(decimals: number, targetAmount: number): number {
  const transferAmountBase = targetAmount * Math.pow(10, decimals);
  const transferAmountCoefficient = 0.75 + Math.random() / 2; // between 0.75 and 1.25
  let transferAmount = transferAmountBase * transferAmountCoefficient;
  const minBalance = calculateMinBalance(decimals);
  if (minBalance == 1) {
    transferAmount = Math.round(transferAmount);
  } else {
    transferAmount = Math.round(transferAmount / minBalance) * minBalance;
  }
  return transferAmount;
}

async function create_token_transfer(
  api: ApiPromise,
  fungibleData: FungibleTokenData,
  token_sender: KeyringPair,
  token_recipients: KeyringPair[],
  amount: number
): Promise<void> {
  logger.info("Generate free transfers between the two users");
  logger.info(`Token ID: ${fungibleData.tokenId}`);
  logger.info(`Token sender: ${token_sender.address}`);

  for (let i = 0; i < token_recipients.length; i++) {
    const transferAmount = calculateTransferAmount(
      fungibleData.decimals,
      amount
    );
    logger.info(`Calculated transfer amount: ${transferAmount}`);
    const tx = api.tx.playerTransfers.submitTransferAssets(
      fungibleData.tokenId,
      token_recipients[i].address,
      transferAmount
    );

    await processSignedTransaction(token_sender, tx);

    logger.info(`Free transfer ${i + 1} created and in block`);
  }

  logger.info("All transfers completed successfully");
}

export {
  create_fungible_tokens,
  create_token_transfer,
  set_metadata_and_mint_fungible_token,
};
