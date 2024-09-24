const maxWaitTime = 12000; // 12 seconds in milliseconds
const maxRetries = 5;
const initialBackoff = 3000; // 3 seconds

async function retryOperation(operation, operationName) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            await operation();
            break;
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

async function processClearingTransaction(api, signer, ct, eventCallback) {
    return retryOperation(async () => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`CT processing timed out after ${maxWaitTime}ms`));
            }, maxWaitTime);

            ct.signAndSend(signer, { nonce: -1 }, ({ events = [], status }) => {
                if (status.isInBlock) {
                    events.forEach((event) => {
                        eventCallback(event);
                    });

                    if (events.some(({ event }) =>
                        api.events.addressPools.CTProcessingCompleted.is(event)
                    )) {
                        console.log("CT processing completed, resolving promise");
                        clearTimeout(timeout);
                        resolve();
                    }
                }
            }).catch((error) => {
                clearTimeout(timeout);
                console.error("Error in processClearingTransaction:", error);
                reject(error);
            });
        });
    }, "processing clearing transaction");
}

async function processSignedTransaction(api, signer, tx, eventCallback = () => { }) {
    return retryOperation(async () => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Transaction timed out after ${maxWaitTime}ms`));
            }, maxWaitTime);

            tx.signAndSend(signer, { nonce: -1 }, ({ events = [], status }) => {
                if (status.isInBlock) {
                    let extrinsicSuccess = false;
                    events.forEach(({ event }) => {
                        eventCallback(event);
                        if (api.events.system.ExtrinsicSuccess.is(event)) {
                            extrinsicSuccess = true;
                        }
                    });

                    if (extrinsicSuccess) {
                        console.log(`Transaction is in block and successful`);
                        clearTimeout(timeout);
                        resolve();
                    } else {
                        clearTimeout(timeout);
                        reject(new Error(`Transfer failed: ExtrinsicSuccess event not found`));
                    }
                }
            }).catch((error) => {
                clearTimeout(timeout);
                console.error("Error in processSignedTransaction:", error);
                reject(error);
            });
        });
    }, "processing signed transaction");
}

async function processSignedBatchTransaction(api, signer, tx, eventCallback = () => { }) {
    return retryOperation(async () => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Transaction timed out after ${maxWaitTime}ms`));
            }, maxWaitTime);

            tx.signAndSend(signer, { nonce: -1 }, ({ events = [], status }) => {
                if (status.isInBlock) {
                    let extrinsicSuccess = false;
                    events.forEach(({ event }) => {
                        eventCallback(event);
                        if (api.events.utility.BatchCompleted.is(event)) {
                            extrinsicSuccess = true;
                            console.log("Batch completed successfully");
                        }
                    });

                    if (extrinsicSuccess) {
                        console.log(`Transaction is in block and successful`);
                        clearTimeout(timeout);
                        resolve();
                    } else {
                        clearTimeout(timeout);
                        reject(new Error(`Transfer failed: ExtrinsicSuccess event not found`));
                    }
                }
            }).catch((error) => {
                clearTimeout(timeout);
                console.error("Error in processSignedTransaction:", error);
                reject(error);
            });
        });
    }, "processing signed transaction");
}



module.exports = {
    retryOperation,
    maxWaitTime,
    maxRetries,
    processClearingTransaction,
    processSignedTransaction,
    processSignedBatchTransaction
}