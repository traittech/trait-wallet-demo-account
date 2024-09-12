"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SS58_FORMAT__TRAIT_ASSET_HUB = exports.decodeAddress = exports.decodeNamed = exports.decodeTransactional = exports.decodeAppAgent = exports.encodeNamed = exports.encodeTransactional = exports.encodeAppAgent = exports.AddressType = void 0;
const util_crypto_1 = require("@polkadot/util-crypto");
const keyring_1 = require("@polkadot/keyring");
const assert_1 = require("assert");
const APP_AGENT_ADDRESS_IDENTIFIER = 1;
const TRANSACTIONAL_ADDRESS_IDENTIFIER = 2;
const NAMED_ADDRESS_IDENTIFIER = 3;
const NAMED_ADDRESS_BYTES_LENGTH = 10;
const SS58_FORMAT__TRAIT_ASSET_HUB = 5335;
exports.SS58_FORMAT__TRAIT_ASSET_HUB = SS58_FORMAT__TRAIT_ASSET_HUB;
var AddressType;
(function (AddressType) {
    AddressType[AddressType["Regular"] = 0] = "Regular";
    AddressType[AddressType["AppAgent"] = 1] = "AppAgent";
    AddressType[AddressType["Transactional"] = 2] = "Transactional";
    AddressType[AddressType["Named"] = 3] = "Named";
})(AddressType || (exports.AddressType = AddressType = {}));
/**
 * Validates that a name contains only allowed ASCII characters.
 *
 * @param {string} name - The name to validate.
 * @returns {boolean} - True if the name is valid
 */
function validateAddressName(name) {
    (0, assert_1.strict)(name.length === NAMED_ADDRESS_BYTES_LENGTH, "Name size not supported");
    const allowedChars = /^[0-9a-zA-Z\-#]+$/;
    (0, assert_1.strict)(allowedChars.test(name), "Name contains invalid characters");
}
/**
 * Encodes an application agent address and returns it.
 *
 * @param {number} appAgentId - The ID of the application agent.
 * @returns {string} - The encoded application agent address.
 */
function encodeAppAgent(appAgentId, ss58Format = SS58_FORMAT__TRAIT_ASSET_HUB) {
    const appAgentIdBytes = Buffer.alloc(4);
    appAgentIdBytes.writeUInt32LE(appAgentId, 0);
    const appAgentIdBuffer = Buffer.from([APP_AGENT_ADDRESS_IDENTIFIER]);
    const openPart = Buffer.concat([appAgentIdBytes, appAgentIdBuffer]);
    const checksum = (0, util_crypto_1.blake2AsU8a)(openPart);
    const address = Buffer.concat([openPart, checksum.slice(openPart.length)]);
    return (0, keyring_1.encodeAddress)(address, ss58Format);
}
exports.encodeAppAgent = encodeAppAgent;
/**
 * Encodes a transactional agent address and returns it.
 *
 * @param {number} appAgentId - The ID of the application agent.
 * @param {number} taId - The ID of the transactional agent.
 * @returns {string} - The encoded transactional agent address.
 */
function encodeTransactional(appAgentId, taId, ss58Format = SS58_FORMAT__TRAIT_ASSET_HUB) {
    const appAgentIdBytes = Buffer.alloc(4);
    appAgentIdBytes.writeUInt32LE(appAgentId, 0);
    const taIdBytes = Buffer.alloc(4);
    taIdBytes.writeUInt32LE(taId, 0);
    const taIdBuffer = Buffer.from([TRANSACTIONAL_ADDRESS_IDENTIFIER]);
    const openPart = Buffer.concat([appAgentIdBytes, taIdBuffer, taIdBytes]);
    const checksum = (0, util_crypto_1.blake2AsU8a)(openPart);
    const address = Buffer.concat([openPart, checksum.slice(openPart.length)]);
    return (0, keyring_1.encodeAddress)(address, ss58Format);
}
exports.encodeTransactional = encodeTransactional;
/**
 * Encodes a named address and returns it.
 *
 * @param {number} appAgentId - The ID of the application agent.
 * @param {string} name - The name of the address.
 * @returns {string} - The encoded named address.
 */
function encodeNamed(appAgentId, name, ss58Format = SS58_FORMAT__TRAIT_ASSET_HUB) {
    validateAddressName(name);
    const appAgentIdBytes = Buffer.alloc(4);
    appAgentIdBytes.writeUInt32LE(appAgentId, 0);
    const nameBytes = Buffer.from(name);
    const taIdBuffer = Buffer.from([NAMED_ADDRESS_IDENTIFIER]);
    const openPart = Buffer.concat([appAgentIdBytes, taIdBuffer, nameBytes]);
    const checksum = (0, util_crypto_1.blake2AsU8a)(openPart);
    const address = Buffer.concat([openPart, checksum.slice(openPart.length)]);
    return (0, keyring_1.encodeAddress)(address, ss58Format);
}
exports.encodeNamed = encodeNamed;
function isEqualArrays(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}
/**
 * Decodes a keyless address and determines its type.
 *
 * @param {string} address - The blockchain address to decode.
 * @returns {BlockchainAddressInfo} - An object containing the decoded address type and data.
 * @throws {Error} - Thrown if the address cannot be decoded or is of an unsupported type.
 */
function decodeAddress(address, ss58Format = SS58_FORMAT__TRAIT_ASSET_HUB) {
    const accountId = (0, keyring_1.decodeAddress)(address, false, ss58Format);
    const accountIdBuffer = Buffer.from(accountId);
    // Read the byte that encodes type of the address
    const addressTypeByte = accountId[4];
    if (addressTypeByte === APP_AGENT_ADDRESS_IDENTIFIER) {
        // Verify checksum
        const openPartSize = 5;
        const openPart = accountId.slice(0, openPartSize);
        const checksum = accountId.slice(openPartSize);
        const checksumCalculated = (0, util_crypto_1.blake2AsU8a)(openPart).slice(openPartSize);
        if (isEqualArrays(checksum, checksumCalculated)) {
            // Extract and decode appAgentId
            const appAgentId = accountIdBuffer.subarray(0, 4).readUint32LE(0);
            return {
                address,
                accountId: `0x${accountIdBuffer.toString("hex")}`,
                addressType: AddressType.AppAgent,
                appAgentId,
                taId: undefined,
                addressName: undefined,
            };
        }
    }
    if (addressTypeByte === TRANSACTIONAL_ADDRESS_IDENTIFIER) {
        // Verify checksum
        const openPartSize = 9;
        const openPart = accountId.slice(0, openPartSize);
        const checksum = accountId.slice(openPartSize);
        const checksumCalculated = (0, util_crypto_1.blake2AsU8a)(openPart).slice(openPartSize);
        if (isEqualArrays(checksum, checksumCalculated)) {
            // Extract and decode appAgentId_bytes and taId_bytes
            const appAgentId = accountIdBuffer.subarray(0, 4).readUint32LE(0);
            const taId = accountIdBuffer.subarray(5, 9).readUint32LE(0);
            return {
                address,
                accountId: `0x${accountIdBuffer.toString("hex")}`,
                addressType: AddressType.Transactional,
                appAgentId,
                taId,
                addressName: undefined,
            };
        }
    }
    if (addressTypeByte === NAMED_ADDRESS_IDENTIFIER) {
        // Verify checksum
        const openPartSize = 15;
        const openPart = accountId.slice(0, openPartSize);
        const checksum = accountId.slice(openPartSize);
        const checksumCalculated = (0, util_crypto_1.blake2AsU8a)(openPart).slice(openPartSize);
        if (isEqualArrays(checksum, checksumCalculated)) {
            // Extract and decode appAgentId and address_name
            const appAgentId = accountIdBuffer.subarray(0, 4).readUint32LE(0);
            const addressName = accountIdBuffer.subarray(5, 15).toString();
            return {
                address,
                accountId: `0x${accountIdBuffer.toString("hex")}`,
                addressType: AddressType.Named,
                appAgentId,
                taId: undefined,
                addressName,
            };
        }
    }
    return {
        address,
        accountId: `0x${accountIdBuffer.toString("hex")}`,
        addressType: AddressType.Regular,
        appAgentId: undefined,
        taId: undefined,
        addressName: undefined,
    };
}
exports.decodeAddress = decodeAddress;
/**
 * Decodes an application agent address.
 *
 * @param {string} address
 * @returns {number} - The ID of the application agent.
 */
function decodeAppAgent(address, ss58Format = SS58_FORMAT__TRAIT_ASSET_HUB) {
    const decodingResult = decodeAddress(address, ss58Format);
    if (decodingResult.addressType !== AddressType.AppAgent) {
        throw new Error(`Provided address is not an AppAgent address but is instance of ${AddressType[decodingResult.addressType]}`);
    }
    if (decodingResult.appAgentId === undefined) {
        throw new Error("Internal error in traitkeyless - appAgentId of AppAgent address is undefined");
    }
    return decodingResult.appAgentId;
}
exports.decodeAppAgent = decodeAppAgent;
/**
 * Decodes a transactional address.
 *
 * @param {string} address - The JSON representation of the encoded transactional address.
 * @returns {Object} - An object containing the IDs of the app agent and transactional agent.
 */
function decodeTransactional(address, ss58Format = SS58_FORMAT__TRAIT_ASSET_HUB) {
    const decodingResult = decodeAddress(address, ss58Format);
    if (decodingResult.addressType !== AddressType.Transactional) {
        throw new Error(`Provided address is not a Transactional address but is instance of ${AddressType[decodingResult.addressType]}`);
    }
    if (decodingResult.appAgentId === undefined) {
        throw new Error("Internal error in traitkeyless - appAgentId of Transactional address is undefined");
    }
    if (decodingResult.taId === undefined) {
        throw new Error("Internal error in traitkeyless - taId of Transactional address is undefined");
    }
    return {
        appAgentId: decodingResult.appAgentId,
        taId: decodingResult.taId,
    };
}
exports.decodeTransactional = decodeTransactional;
/**
 * Decodes a named address.
 *
 * @param {string} address - The JSON representation of the encoded named address.
 * @returns {BlockchainAddressInfo} - An object containing the IDs of the application agent and name.
 */
function decodeNamed(address, ss58Format = SS58_FORMAT__TRAIT_ASSET_HUB) {
    const decodingResult = decodeAddress(address, ss58Format);
    if (decodingResult.addressType !== AddressType.Named) {
        throw new Error(`Provided address is not a Named address but is instance of ${AddressType[decodingResult.addressType]}`);
    }
    if (decodingResult.appAgentId === undefined) {
        throw new Error("Internal error in traitkeyless - appAgentId of Named address is undefined");
    }
    if (decodingResult.addressName === undefined) {
        throw new Error("Internal error in traitkeyless - addressName of Named address is undefined");
    }
    return {
        appAgentId: decodingResult.appAgentId,
        addressName: decodingResult.addressName,
    };
}
exports.decodeNamed = decodeNamed;
