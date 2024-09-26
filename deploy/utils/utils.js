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

            let unsubscribe;
            let eventsUnsubscribe;
            let transactionCompleted = false;

            const checkEvents = (events) => {
                events.forEach((event) => {
                    eventCallback(event);
                    
                    if (api.events.system.ExtrinsicSuccess.is(event)) {
                        transactionCompleted = true;
                    }
                });

                if (transactionCompleted) {
                    console.log(`Transaction successful and processing completed`);
                    clearTimeout(timeout);
                    if (unsubscribe) unsubscribe();
                    if (eventsUnsubscribe) eventsUnsubscribe();
                    resolve();
                }
            };

            await tx.signAndSend(signer, { nonce: -1 }).catch((error) => {
                clearTimeout(timeout);
                console.error("Error in processSignedTransaction:", error);
                reject(error);
            });

            // Subscribe to system events via storage
            eventsUnsubscribe = await api.query.system.events((events) => {
                console.log(`Waiting to confirm transaction success`);
                checkEvents(events);
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

            let unsubscribe;
            let eventsUnsubscribe;
            let batchCompleted = false;

            const checkEvents = (events) => {
                events.forEach((event) => {
                    eventCallback(event);
                    
                    if (api.events.utility.BatchCompleted.is(event)) {
                        batchCompleted = true;
                        console.log(`Batch completed`);
                    }
                });

                if (batchCompleted) {
                    console.log(`Transaction successful and batch processing completed`);
                    clearTimeout(timeout);
                    if (unsubscribe) unsubscribe();
                    if (eventsUnsubscribe) eventsUnsubscribe();
                    resolve();
                }
            };

            await tx.signAndSend(signer, { nonce: -1 })
            .catch((error) => {
                clearTimeout(timeout);
                console.error("Error in processSignedBatchTransaction:", error);
                reject(error);
            });

            // Subscribe to system events via storage
            eventsUnsubscribe = await api.query.system.events((events) => {
                console.log(`Waiting to confirm transaction success`);
                checkEvents(events);
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