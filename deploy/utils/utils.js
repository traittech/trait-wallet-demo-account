const maxWaitTime = 12000; // 12 seconds in milliseconds
const maxRetries = 5;
const initialBackoff = 6000; // 6 seconds

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

async function processClearingTransaction(api, signer, ctCall, eventCallback = {}, maxWaitTime = 300000) {
    return retryOperation(async () => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Timeout: CT processing took too long"));
            }, maxWaitTime);

            try {
                ctCall.signAndSend(signer, { nonce: -1 }, ({ status, events }) => {
                    if (status.isInBlock || status.isFinalized) {
                        clearTimeout(timeout);

                        let ctCompleted = false;
                        let errorMessage = null;

                        console.log("Processing events for CT:");
                        events.forEach((event) => {
                            console.log(`Event: ${event.event.section}.${event.event.method}`);
                            
                            // Check for CTProcessingCompleted event
                            if (event.event.section === 'addressPools' && event.event.method === 'CTProcessingCompleted') {
                                console.log("CTProcessingCompleted event found");
                                const [, , , , failedAtomicNumber] = event.event.data;
                                console.log(`CTProcessingCompleted event data: ${event.event.data.toString()}`);
                                console.log(`Failed atomic number: ${failedAtomicNumber.toString()}`);
                                
                                if (failedAtomicNumber.eq(0)) {
                                    console.log("CT completed successfully");
                                    ctCompleted = true;
                                } else {
                                    errorMessage = `CT processing failed at atomic number: ${failedAtomicNumber.toString()}`;
                                    console.log(errorMessage);
                                }
                            }

                            // Allow user to process other events
                            if (eventCallback) {
                                eventCallback(event);
                            }
                        });

                        if (ctCompleted) {
                            console.log("Resolving promise - CT completed successfully");
                            resolve();
                        } else {
                            console.log("Rejecting promise - CT did not complete successfully");
                            reject(new Error(errorMessage || "CT did not complete successfully"));
                        }
                    }
                });
            } catch (error) {
                clearTimeout(timeout);
                console.log("Caught error in signAndSend:", error);
                reject(error);
            }
        });
    }, "processing Clearing Transaction");
}

module.exports = {
    retryOperation,
    maxWaitTime,
    maxRetries,
    processClearingTransaction
}