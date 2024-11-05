import fs from "fs";
import path from "path";
import Pino from "pino";
import { KeyringPair } from "@polkadot/keyring/types";
import { AppAgentData, FungibleTokenData, NftCollectionData, GameData } from "./types";

const logger = Pino();

function collectGameData(gameFolders: string[], appAgentOwners: KeyringPair[], aws_s3_assets_path: string): GameData[] {
  if (gameFolders.length != gameFolders.length) {
    throw new Error(`Mismatch of number of game folders and game owners: ${gameFolders.length} and ${appAgentOwners.length}`);
  }

  const gameDataList: GameData[] = [];

  for (const [gameIndex, gameFolder] of gameFolders.entries()) {
    const appAgentOwner = appAgentOwners[gameIndex];

    let appAgent: AppAgentData | null = null;
    const fungibles: FungibleTokenData[] = [];
    const nftCollections: NftCollectionData[] = [];
    
    const subFolders = fs.readdirSync(gameFolder);

    // iterate all subdirs and find metadata for all objects
    for (const subFolder of subFolders) {
      const folderPath = path.join(gameFolder, subFolder);

      if (subFolder.startsWith("app-agent-")) {
        const appAgentMeta =  getObjectMetadataURL(folderPath, aws_s3_assets_path);
        appAgent = {
          agentId: null,
          appAgentOwner: appAgentOwner,
          metadataFilePath: appAgentMeta.filePath,
          metadataUrl: appAgentMeta.url,
        };

      } else if (subFolder.startsWith("fungible-")) {
        const fungibleMeta = getObjectMetadataURL(folderPath, aws_s3_assets_path);
        const fungibleDecimals = getFungibleDecimals(fungibleMeta.filePath);
        fungibles.push({
          tokenId: null,
          metadataFilePath: fungibleMeta.filePath,
          metadataUrl: fungibleMeta.url,
          decimals: fungibleDecimals
        });

      } else if (subFolder.startsWith("nft-collection")) {
        let collectionData: NftCollectionData | null = null; // = { metadataUrl: null, nftTokens: [] };
        const subsubFolders = fs.readdirSync(folderPath);

        // get info about NFT collection
        for (const subsubFolder of subsubFolders) {
          const subFolderPath = path.join(folderPath, subsubFolder);
          if (subsubFolder.startsWith("nft-collection")) {
            const collectionMeta = getObjectMetadataURL(subFolderPath, aws_s3_assets_path);
            collectionData = {
              collectionId: null,
              metadataFilePath: collectionMeta.filePath,
              metadataUrl: collectionMeta.url,
              nftTokens: []
            };
          }
        }
        if (typeof collectionData === 'undefined' || collectionData === null) {
          throw new Error(`Couldn't find metadata for NFT Collection: ${subFolder}`);
        }

        // get info about NFT tokens
        for (const subsubFolder of subsubFolders) {
          const subFolderPath = path.join(folderPath, subsubFolder);
          if (subsubFolder.startsWith("nft-token")) {
            const tokenMeta = getObjectMetadataURL(subFolderPath, aws_s3_assets_path);
            collectionData.nftTokens.push({
              collectionId: null,
              tokenId: null,
              metadataFilePath: tokenMeta.filePath,
              metadataUrl: tokenMeta.url,
            });
          }
        }

        nftCollections.push(collectionData);
      }
    }

    // check results
    if (typeof appAgent === 'undefined' || appAgent === null) {
      throw new Error(`Couldn't find metadata for AppAgent in the folder: ${gameFolder}`);
    }
    if (fungibles.length === 0) {
      logger.warn(`Didn't find fungible tokens for AppAgent in the folder: ${gameFolder}`);
    }
    if (nftCollections.length === 0) {
      logger.warn(`Didn't find NFT Collections for AppAgent in the folder: ${gameFolder}`);
    }
    for (const nftCollection of nftCollections) {
      if (nftCollection.nftTokens.length === 0) {
        logger.warn(`Didn't find NFT tokens for NFT Collection: ${nftCollection.metadataFilePath}`);
      }
    }

    // construct response
    const gameData: GameData = {
      appAgent: appAgent,
      fungibles: fungibles,
      nftCollections: nftCollections,
    };
    gameDataList.push(gameData);
  }

  return gameDataList;
}

/**
 * Function searches for the json file with object metadata.
 * And calculates the metadata URL based on the file path.
 *
 * @param {string} directory - The directory where the metadata file is stored.
 * @return {string|null} The metadata URL if found, otherwise null.
 */
function getObjectMetadataURL(
  directory: string, aws_s3_assets_path: string
): { url: string; filePath: string } {
  const files = fs.readdirSync(directory);
  const jsonFiles = files.filter((file) => file.endsWith(".json"));

  if (jsonFiles.length == 0) {
    throw new Error(`Didn't find any metadata files in the dir ${directory}`);
  } else if ((jsonFiles.length > 1)) {
    throw new Error(`Found more than one metadata file in the dir ${directory}: ${jsonFiles}`);
  }

  const jsonFile = jsonFiles[0];
  const jsonFilePath = path.join(directory, jsonFile);
  const relativePath = path.relative(aws_s3_assets_path, jsonFilePath);
  const url = `${process.env.CONTENT_BASE_URL}/${relativePath.replace(
    /\\/g,
    "/"
  )}`;
  return {url, filePath: jsonFilePath};
}

/**
 * Function searches for the json file with object metadata.
 * And calculates the metadata URL based on the file path.
 *
 * @param {string} directory - The directory where the metadata file is stored.
 * @return {string|null} The metadata URL if found, otherwise null.
 */
function getFungibleDecimals(
  metadataFilePath: string
): number {
  const fileContent = fs.readFileSync(metadataFilePath, "utf8");
  const jsonData = JSON.parse(fileContent);
  // get the decimals from the fungible metadata
  const decimals = jsonData.traits.fungible.decimals;

  return decimals;
}

export {
  collectGameData,
};
