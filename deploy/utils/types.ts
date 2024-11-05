export type NftCollectionData = {
  metadataUrl?: string | null;
  nftTokens: { metadataUrl?: string; tokenId?: number }[];
  collectionId?: string;
  tokenId?: number;
};

export type FungibleTokenData = {
  metadataUrl?: string;
  decimals: number;
  tokenId?: string;
};

export type GameData = {
  appAgent: { metadataUrl?: string } | null;
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
