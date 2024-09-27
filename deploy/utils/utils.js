const { getAllEvents } = require('./datagate');

const maxWaitTime = 6000000; // 10 minutes in milliseconds
const maxRetries = 3;
const initialBackoff = 30000; // 30 seconds

async function retryOperation(operation, operationName) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            let result = await operation();
            return result;
        } catch (err) {
            retries++;
            if (retries === maxRetries) {
                console.log(`Failed to ${operationName} after ${maxRetries} attempts`);
                throw err;
            }
            const backoffTime = initialBackoff * Math.pow(2, retries - 1);
            console.log(`Error ${operationName}: ${err}. Retrying in ${backoffTime}ms. Attempt ${retries} of ${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
    }
}

async function processClearingTransaction(api, signer, ct, eventCallback = () => { }) {
    return retryOperation(async () => {
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`CT processing timed out after ${maxWaitTime}ms`));
            }, maxWaitTime);

            let unsubscribe;

            try {
                unsubscribe = await ct.signAndSend(signer, { nonce: -1 }, async ({ status, txHash }) => {
                    if (status.isFinalized) {
                        console.log(`Transaction finalized in block with hash: ${txHash}`);
                        try {
                            // Check if event has occurred in datagate
                            const events = await checkEventOccurrenceWithRetry(txHash.toString(), "AddressPools", "CTProcessingCompleted");
                            console.log(`CT processing completed successfully`);
                            clearTimeout(timeout);
                            if (unsubscribe) unsubscribe();
                            resolve(events);
                        } catch (error) {
                            console.error("Error checking event occurrence:", error);
                            reject(error);
                        }
                    } else if (status.isInBlock) {
                        console.log(`Transaction included in block: ${status.asInBlock}`);
                    }
                });
            } catch (error) {
                clearTimeout(timeout);
                console.error("Error in processClearingTransaction:", error);
                reject(error);
            }
        });
    }, "processing clearing transaction");
}

async function processSignedTransaction(api, signer, tx, eventCallback = () => { }) {
    return retryOperation(async () => {
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Transaction timed out after ${maxWaitTime}ms`));
            }, maxWaitTime);

            let unsubscribe;

            try {
                unsubscribe = await tx.signAndSend(signer, { nonce: -1 }, async ({ events = [], status, txHash }) => {
                    if (status.isFinalized) {
                        console.log(`Transaction finalized in block with hash: ${txHash}`);
                        try {
                            // check if event has occurred in datagate
                            let events = await checkEventOccurrenceWithRetry(txHash.toString(), "System", "ExtrinsicSuccess");
                            console.log(`Transaction completed successfully with events: ${events}`);
                            clearTimeout(timeout);
                            if (unsubscribe) unsubscribe();
                            resolve(events);
                        } catch (error) {
                            console.error("Error checking event occurrence:", error);
                            reject(error);
                        }
                    } else if (status.isInBlock) {
                        console.log(`Transaction included in block: ${status.asInBlock}`);
                    }
                });
            } catch (error) {
                clearTimeout(timeout);
                console.error("Error in processSignedTransaction:", error);
                reject(error);
            }
        });
    }, "processing signed transaction");
}

async function processSignedBatchTransaction(api, signer, tx, eventCallback = () => { }) {
    return retryOperation(async () => {
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Batch transaction timed out after ${maxWaitTime}ms`));
            }, maxWaitTime);

            let unsubscribe;

            try {
                unsubscribe = await tx.signAndSend(signer, { nonce: -1 }, async ({ events = [], status, txHash }) => {
                    if (status.isInBlock) {
                        console.log(`Transaction included in block with hash: ${txHash}, waiting for finalization`);
                    }
                    if (status.isFinalized) {
                        console.log(`Transaction finalized with hash: ${txHash}`);
                        try {
                            // check if event has occurred in datagate
                            let events = await checkEventOccurrenceWithRetry(txHash.toString(), "Utility", "BatchCompleted");
                            console.log(`Batch transaction completed successfully`);
                            clearTimeout(timeout);
                            if (unsubscribe) unsubscribe();
                            resolve(events);
                        } catch (error) {
                            console.error("Error checking event occurrence:", error);
                            reject(error);
                        }
                    }
                });
            } catch (error) {
                clearTimeout(timeout);
                console.error("Error in processSignedBatchTransaction:", error);
                reject(error);
            }
        });
    }, "processing signed batch transaction");
}

async function checkEventOccurrenceWithRetry(transaction_hash, module_name, event_name) {
    return retryOperation(async () => {
        console.log(`Checking events for transaction ${transaction_hash}`);
        const result = await getAllEvents(transaction_hash);
        if (result) {
            console.log(result);
            for (const event of result) {
                console.log(event);
                if (event.receipt.event_module === module_name && event.receipt.event_name === event_name) {
                    console.log(`Event ${module_name}.${event_name} confirmed for transaction ${transaction_hash}`);
                    return result;
                }
            }
            throw new Error(`Event ${module_name}.${event_name} not found for transaction ${transaction_hash}`);
        } else {
            throw new Error(`Event ${module_name}.${event_name} not found for transaction ${transaction_hash}`);
        }
    }, "checking event occurrence");
}


module.exports = {
    retryOperation,
    maxWaitTime,
    maxRetries,
    processClearingTransaction,
    processSignedTransaction,
    processSignedBatchTransaction
}