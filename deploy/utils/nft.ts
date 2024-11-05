import { ApiPromise } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";
import Pino from "pino";
import { NftCollectionData } from "./types";
import {
  processClearingTransaction,
  processSignedTransaction,
} from "./utils.js";

const logger = Pino();

async function create_nft_collections(
  api: ApiPromise,
  appAgentOwner: KeyringPair,
  appAgentId: number,
  collectionDataList: NftCollectionData[],
): Promise<void> {
  try {
    logger.info(
      "Start to create NFT Collections for the AppAgent ID " + appAgentId
    );

    logger.info("Build Clearing transaction to create NFT Collections");
    const atomics = [];

    const create_nft_call = api.tx.nfts.create();

    for (let i = 0; i < collectionDataList.length; i++) { // eslint-disable-line @typescript-eslint/prefer-for-of
      const create_nft_action = [{ AppAgentId: appAgentId }, create_nft_call];
      const create_nft_atomic = [create_nft_action];
      atomics.push(create_nft_atomic);
    }

    const create_nft_ct = api.tx.addressPools.submitClearingTransaction(
      appAgentId,
      atomics
    );

    logger.info(
      "Process clearing transaction successfully and collect IDs of created NFT collections."
    );
    const collection_ids: number[] = [];
    const events = await processClearingTransaction(
      appAgentOwner,
      create_nft_ct
    );
    for (const event of events) {
      if (
        event.receipt.event_module === "Nfts" &&
        event.receipt.event_name === "Created"
      ) {
        const collection_id = parseInt(event.attributes.collection.toString());
        logger.info("NFT Collection created with ID: " + collection_id);
        collection_ids.push(collection_id);
      }
    }

    logger.info(`Generated collection IDs: ${collection_ids}`);
    if (collection_ids.length != collectionDataList.length) {
      throw new Error("Not all NFT collections were created");
    }

    logger.info(`Save IDs of NFT collections for later use`);
    for (let i = 0; i < collection_ids.length; i++) {
      collectionDataList[i].collectionId = collection_ids[i];
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : error;
    logger.error(message, "Error creating NFT Collections");
    throw error;
  }
}

async function set_metadata_and_mint_nft(
  api: ApiPromise,
  appAgentOwner: KeyringPair,
  appAgentId: string | number,
  collectionData: NftCollectionData,
  token_recipient: string
): Promise<void> {
  try {
    logger.info(
      "Start to configure NFT Collection `" +
        collectionData.collectionId +
        "` for the AppAgent ID " +
        appAgentId
    );

    const nftTokenIds: number[] = [];

    logger.info("Build Clearing transaction to setup NFT collection");
    // As we have a small number of NFT tokens in each collection - only 10 -
    // we can join all operations into a single CT.
    const atomics = [];

    logger.info("Create atomic to set collection metadata");
    const set_collection_metadata_call = api.tx.nfts.setCollectionMetadata(
      collectionData.collectionId,
      collectionData.metadataUrl
    );
    const set_collection_metadata_action = [
      { AppAgentId: appAgentId },
      set_collection_metadata_call,
    ];
    const set_collection_metadata_atomic = [set_collection_metadata_action];
    atomics.push(set_collection_metadata_atomic);

    logger.info("Create atomics to mint and configure NFT tokens.");
    let tokenId = 0;
    for (const nftToken of collectionData.nftTokens) {
      const metadataUrl = nftToken.metadataUrl;

      logger.info(
        "Create atomic for NFT token: CollectionId - " +
          collectionData.collectionId +
          "; TokenId - " +
          tokenId +
          "; metadata URL: " +
          metadataUrl
      );

      const mint_nft_call = api.tx.nfts.mint(
        collectionData.collectionId,
        tokenId,
        token_recipient
      );
      const mint_nft_action = [{ AppAgentId: appAgentId }, mint_nft_call];
      const set_metadata_call = api.tx.nfts.setMetadata(
        collectionData.collectionId,
        tokenId,
        metadataUrl
      );
      const set_metadata_action = [
        { AppAgentId: appAgentId },
        set_metadata_call,
      ];
      const nft_atomic = [mint_nft_action, set_metadata_action];
      atomics.push(nft_atomic);

      nftTokenIds.push(tokenId);
      tokenId += 1;
    }

    logger.info(
      "Sending CT to mint & configure NFT Tokens, and to set Collection metadata."
    );
    const configure_nft_collection_ct =
      api.tx.addressPools.submitClearingTransaction(appAgentId, atomics);
    await processClearingTransaction(
      appAgentOwner,
      configure_nft_collection_ct
    );

    logger.info(`Save IDs of NFT tokens for later use`);
    for (let k = 0; k < collectionData.nftTokens.length; k++) {
      collectionData.nftTokens[k].collectionId = collectionData.collectionId;
      collectionData.nftTokens[k].tokenId = nftTokenIds[k];
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : error;
    logger.error(message, "Error in set_metadata_and_mint_nft");
    throw error;
  }
}

async function create_nft_transfers(
  api: ApiPromise,
  collection_id: number,
  token_id: number,
  token_sender: KeyringPair,
  token_recipient: KeyringPair
): Promise<void> {
  logger.info("Generate free transfers between the two users");
  logger.info("Collection ID: " + collection_id);
  logger.info("Token ID: " + token_id);
  logger.info("Token Sender: " + token_sender.address);
  logger.info("Token Recipient: " + token_recipient.address);

  const tx = api.tx.playerTransfers.submitTransferNfts(
    collection_id,
    token_id,
    token_recipient.address
  );

  await processSignedTransaction(token_sender, tx);
  logger.info(`Free transfer created and confirmed`);
}

export {
  create_nft_collections,
  create_nft_transfers,
  set_metadata_and_mint_nft,
};
