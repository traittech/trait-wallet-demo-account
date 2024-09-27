const { encodeNamed } = require("./keyless");
const { processClearingTransaction, processSignedTransaction } = require("./utils");

async function create_fungible_tokens(api, appAgentOwner, appAgentId, tokenCount) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("Start to create fungible tokens for the AppAgent ID " + appAgentId);
            console.log("Token count: ", tokenCount);

            let token_admin = encodeNamed(appAgentId, "asset-admi");
            let tokenIds = [];

            let atomics = [];

            for (let i = 0; i < tokenCount; i++) {
                let create_fungible_token = api.tx.assets.create(token_admin, 1);
                atomics.push([{ AppAgentId: appAgentId }, create_fungible_token]);
            }

            let create_fungible_token_ct = api.tx.addressPools.submitClearingTransaction(
                appAgentId,
                [atomics]
            );

            let events = await processClearingTransaction(api, appAgentOwner, create_fungible_token_ct);
            for (const event of events) {
                if (event.receipt.event_module === 'Assets' && event.receipt.event_name === 'Created') {
                    tokenIds.push(event.attributes.asset_id.toString());
                }
            }

            console.log("Generated token IDs: ", tokenIds);

            if (tokenIds.length != tokenCount) {
                throw new Error("Not all required fungibles were created");
            }

            console.log("Resolving promise with tokenIds:", collection_ids);
            resolve(tokenIds);
        } catch (error) {
            console.error("Error creating fungible tokens:", error);
            reject(error);
        }
    });
}

function convertDecimalsToAmount(decimals, amount) {
    if (decimals === undefined || decimals === null || decimals === 0) {
        return amount;
    }

    return amount * Math.pow(10, decimals);
}

async function set_metadata_and_mint_fungible_token(api, appAgentOwner, appAgentId, tokenIds, metadataUrls, token_recipient, decimals) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("Start to create fungible token for the AppAgent ID " + appAgentId);
            console.log("Decimals: ", decimals);
            console.log("Token IDs: ", tokenIds);
            console.log("Metadata URLs: ", metadataUrls);

            let token_admin = encodeNamed(appAgentId, "asset-admi");

            // create atomics to mint and set metadata for each token
            let atomics = [];
            for (let i = 0; i < tokenIds.length; i++) {
                console.log(`Creating atomic for token ${tokenIds[i]}`);
                atomics.push([{ NamedAddress: token_admin }, api.tx.assets.mint(tokenIds[i], token_recipient.address, convertDecimalsToAmount(decimals[i], 1000))]);
                atomics.push([{ AppAgentId: appAgentId }, api.tx.assets.setMetadata(tokenIds[i], metadataUrls[i])]);
            }

            console.log(`Total atomics created: ${atomics.length}`);

            let configure_fungible_ct = api.tx.addressPools.submitClearingTransaction(
                appAgentId,
                [atomics]
            );

            let events = await processClearingTransaction(api, appAgentOwner, configure_fungible_ct);

            console.log("Fungible tokens configured successfully");

            // wait 12 secs
            await new Promise(resolve => setTimeout(resolve, 12000));

            resolve();
        } catch (error) {
            console.error("Error setting metadata and minting fungible tokens:", error);
            reject(error);
        }
    });
}

async function create_token_transfer(api, token_id, token_sender, token_recipients, amount) {
    console.log("Generate free transfers between the two users");
    console.log("Token ID: ", token_id);
    console.log("Token sender: ", token_sender.address);

    for (let i = 0; i < token_recipients.length; i++) {

        let tx = api.tx.playerTransfers.submitTransferAssets(
            token_id,
            token_recipients[i].address,
            amount
        );

        await processSignedTransaction(api, token_sender, tx);

        console.log(`Free transfer ${i + 1} created and in block`);
    }

    console.log("All transfers completed successfully");
}

module.exports = {
    create_fungible_tokens,
    set_metadata_and_mint_fungible_token,
    create_token_transfer
}
