import { ApiPromise } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";
import { processSignedTransaction } from "./utils.js";

async function create_app_agent(
  api: ApiPromise,
  appAgentOwner: KeyringPair,
  metadataUrl?: string
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(
        "Start to create AppAgent for the owner: " + appAgentOwner.address
      );

      let appagentId;

      const tx = api.tx.appAgents.createAppAgent();
      const events = await processSignedTransaction(appAgentOwner, tx);

      if (events) {
        for (const event of events) {
          if (
            event.receipt.event_module === "AppAgents" &&
            event.receipt.event_name === "AppAgentCreated"
          ) {
            appagentId = event.attributes.app_agent_id.toString();
          }
        }
      }

      console.log("Create the transaction to set the metadata");
      const set_metadata_tx = api.tx.appAgents.setAppAgentMetadata(
        appagentId,
        metadataUrl
      );
      await processSignedTransaction(appAgentOwner, set_metadata_tx);

      resolve(appagentId);
    } catch (error) {
      reject(error);
    }
  });
}

export { create_app_agent };