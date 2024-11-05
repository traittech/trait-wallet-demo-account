import axios from "axios";
import dotenv from "dotenv";
import Pino from "pino";
import { EventInfo } from "./types";
dotenv.config();

const logger = Pino();

function buildDatagateUrl(): string {
  const datagateUrl = process.env.DATAGATE_URL;
  if (!datagateUrl) {
    throw new Error("DATAGATE_URL is not set in the .env file");
  }
  return datagateUrl + "/history/transactions";
}

async function getAllTxEvents(transaction_hash: string): Promise<EventInfo[] | null> {
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
      include_events: true,
    },
  };

  try {
    const response = await axios.post(apiUrl, requestBody);

    if (response.data && response.data.data) {
      if (response.data.data.length == 1) {
        return response.data.data[0].events;
      } else if (response.data.data.length == 0) {
        return null;
      } else {
        throw new Error(`DATAGATE | Foun more than one TX with the hash ${transaction_hash}`);
      }
    } else {
      throw new Error(`DATAGATE | Could not fetch data of TX with the hash ${transaction_hash}`);
    }
  } catch (error) {
    logger.error(error, "Error calling the API");
    throw error;
  }
}

export { getAllTxEvents as getAllEvents };
