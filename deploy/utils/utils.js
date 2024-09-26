const maxWaitTime = 300000; // 5 minutes in milliseconds
const maxRetries = 3;
const initialBackoff = 30000; // 30 seconds

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

async function processClearingTransaction(api, signer, ct, eventCallback = () => { }) {
    return retryOperation(async () => {
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`CT processing timed out after ${maxWaitTime}ms`));
            }, maxWaitTime);

            let unsubscribe;
            let eventsUnsubscribe;
            let ctProcessingCompleted = false;

            const checkEvents = (events) => {
                events.forEach((event) => {
                    //console.log(event);
                    eventCallback(event);
                    
                    if (api.events.addressPools.CTProcessingCompleted.is(event)) {
                        ctProcessingCompleted = true;
                    }
                });

                if (ctProcessingCompleted) {
                    console.log(`Transaction successful and CT processing completed`);
                    clearTimeout(timeout);
                    if (unsubscribe) unsubscribe();
                    if (eventsUnsubscribe) eventsUnsubscribe();
                    resolve();
                }
            };

            unsubscribe = await ct.signAndSend(signer, { nonce: -1 }, ({ events = [], status, txHash }) => {
                if (status.isInBlock) {
                    console.log(`Transaction included in block with hash: ${txHash}`);
                    checkEvents(events);
                }
            }).catch((error) => {
                clearTimeout(timeout);
                console.error("Error in processClearingTransaction:", error);
                reject(error);
            });

            // Subscribe to system events via storage
            eventsUnsubscribe = await api.query.system.events((events) => {
                console.log(`\nReceived ${events.length} events:`);
                checkEvents(events);
            });
        });
    }, "processing clearing transaction");
}

async function processSignedTransaction(api, signer, tx, eventCallback = () => { }) {
    return retryOperation(async () => {
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Transaction timed out after ${maxWaitTime}ms`));
            }, maxWaitTime);

            const unsubscribe = await tx.signAndSend(signer, { nonce: -1 }, ({ events = [], status, txHash }) => {
                if (status.isInBlock) {
                    console.log(`Transaction finalized with hash: ${txHash}`);

                    let extrinsicSuccess = false;
                    events.forEach(({ event }) => {
                        // Pass every event to the events callback
                        eventCallback(event);
                        // Check TX status
                        if (api.events.system.ExtrinsicSuccess.is(event)) {
                            extrinsicSuccess = true;
                        }
                    });

                    // Check TX status
                    if (extrinsicSuccess) {
                        console.log(`Transaction is in block and successful`);
                        clearTimeout(timeout);
                        resolve();
                    } else {
                        clearTimeout(timeout);
                        reject(new Error(`Transaction failed: ExtrinsicSuccess event not found`));
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
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Batch transaction timed out after ${maxWaitTime}ms`));
            }, maxWaitTime);

            const unsubscribe = await tx.signAndSend(signer, { nonce: -1 }, ({ events = [], status, txHash }) => {
                if (status.isInBlock) {
                    console.log(`Transaction finalized with hash: ${txHash}`);
                    let extrinsicSuccess = false;
                    events.forEach(({ event }) => {
                        // Pass every event to the events callback
                        eventCallback(event);
                        // Check TX status
                        if (api.events.utility.BatchCompleted.is(event)) {
                            extrinsicSuccess = true;
                        }
                    });

                    // Check TX status
                    if (extrinsicSuccess) {
                        console.log(`Transaction is in block and successful`);
                        clearTimeout(timeout);
                        resolve();
                    } else {
                        clearTimeout(timeout);
                        reject(new Error(`Transaction failed: BatchCompleted event not found`));
                    }
                }
            }).catch((error) => {
                clearTimeout(timeout);
                console.error("Error in processSignedBatchTransaction:", error);
                reject(error);
            });
        });
    }, "processing signed batch transaction");
}



module.exports = {
    retryOperation,
    maxWaitTime,
    maxRetries,
    processClearingTransaction,
    processSignedTransaction,
    processSignedBatchTransaction
}