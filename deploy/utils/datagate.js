const dotenv = require("dotenv");
const axios = require('axios');
dotenv.config();

function buildDatagateUrl() {

    const datagateUrl = process.env.DATAGATE_URL;
    if (!datagateUrl) {
        throw new Error("DATAGATE_URL is not set in the .env file");
    }
    return datagateUrl + "/history/events";
}

function getAllEvents(transaction_hash) {
    return new Promise(async (resolve, reject) => {
        const apiUrl = buildDatagateUrl();

        console.log("DATAGATE:Checking event occurrence for transaction:", transaction_hash);

        const requestBody = {
            "block_receipt": {
                "block_index": {
                    "max_index": "blockchain_head"
                }
            },
            "tx_receipt": {
                "tx_hash": transaction_hash
            },
            "presentation": {
                "sorting": "time_ascending"
            }
        };

        try {
            const response = await axios.post(apiUrl, requestBody);

            // console.log("DATAGATE:Response:", response.data);

            if (response.data && response.data.data && response.data.data.length > 0) {
                resolve(response.data.data);
            } else {
                console.log(`No events found for the transaction '${transaction_hash}'`)
                // console.log("DATAGATE:Response:", response.data);
                resolve(false);
            }
        } catch (error) {
            console.error('Error calling the API:', error);
            reject(error);
        }
    });
}

module.exports = {
    getAllEvents
};

