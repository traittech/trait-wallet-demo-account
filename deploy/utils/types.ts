import { KeyringPair } from "@polkadot/keyring/types";

export type NftTokenData = {
  collectionId: number | null;
  tokenId: number | null
  metadataFilePath: string,
  metadataUrl: string;
};

export type NftCollectionData = {
  collectionId: number | null;
  metadataFilePath: string,
  metadataUrl: string;
  nftTokens: NftTokenData[];
};

export type FungibleTokenData = {
  tokenId: number | null;
  metadataFilePath: string,
  metadataUrl: string;
  decimals: number;
};

export type AppAgentData = {
  agentId: number | null;
  appAgentOwner: KeyringPair,
  metadataFilePath: string,
  metadataUrl: string;
};

export type GameData = {
  appAgent: AppAgentData;
  fungibles: FungibleTokenData[];
  nftCollections: NftCollectionData[];
};

export type EventInfo = {
  receipt: {
    block_hash: string;
    block_index: number;
    block_timestamp: number;
    tx_type: string;
    tx_hash: string;
    tx_index: number;
    tx_module: string;
    tx_function: string;
    tx_origin: {
      address: string;
      account_id: string;
      address_type: string;
      app_agent_id: number | null;
      ta_id: string | null;
      address_name: string | null;
    };
    event_index: number;
    event_module: string;
    event_name: string;
    event_phase: string;
  };
  attributes: {
    collection: number;
    asset_id: number;
    app_agent_id: number;
    app_agent_address: {
      address: string;
      account_id: string;
      address_type: string;
      app_agent_id: number;
      ta_id: string | null;
      address_name: string | null;
    };
    app_agent_owner: {
      address: string;
      account_id: string;
      address_type: string;
      app_agent_id: number | null;
      ta_id: string | null;
      address_name: string | null;
    };
  };
};
