import axios from "axios";
import dotenv from "dotenv";
import Pino from "pino";
import { EventInfo } from "./types";
dotenv.config();

const logger = Pino();

// TODO rework to /history/transactions

function buildDatagateUrl(): string {
  const datagateUrl = process.env.DATAGATE_URL;
  if (!datagateUrl) {
    throw new Error("DATAGATE_URL is not set in the .env file");
  }
  return datagateUrl + "/history/events";
}

async function getAllEvents(transaction_hash: string): Promise<EventInfo[]> {
  const apiUrl = buildDatagateUrl();

  logger.debug(`DATAGATE: Checking event occurrence for transaction: ${transaction_hash}`, transaction_hash);

  const requestBody = {
    block_receipt: {
      block_index: {
        max_index: "blockchain_head",
      },
    },
    tx_receipt: {
      tx_hash: transaction_hash,
    },
    presentation: {
      sorting: "time_ascending",
    },
  };

  try {
    const response = await axios.post(apiUrl, requestBody);

    if (response.data && response.data.data && response.data.data.length > 0) {
      return response.data.data;
    } else {
      logger.info(`No events found for the transaction '${transaction_hash}'`);
      return [];
    }
  } catch (error) {
    logger.error(error, "Error calling the API");
    throw error;
  }
}

export { getAllEvents };
