"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySignature = exports.sha256 = exports.splitIntoSections = exports.dnsLookup = void 0;
const bitcore_lib_1 = __importDefault(require("bitcore-lib"));
const utils_1 = __importDefault(require("../bitcore-wallet-service/src/lib/common/utils"));
const dns_1 = __importDefault(require("dns"));
const crypto_1 = __importDefault(require("crypto"));
const varuint_bitcoin_1 = __importDefault(require("varuint-bitcoin"));
const { Signature } = bitcore_lib_1.default.crypto;
const dnsLookup = (hostname) => new Promise((resolve, reject) => {
    dns_1.default.lookup(hostname, {
        family: 4,
        all: true, // return all addresses
    }, (err, addresses) => {
        if (err)
            reject(err);
        else
            resolve(addresses.map(a => a.address));
    });
});
exports.dnsLookup = dnsLookup;
const splitIntoSections = (splitConfig) => {
    const headerPatt = /\[(.+)]/;
    const sections = [];
    for (const [key, value] of splitConfig) {
        if (headerPatt.test(key)) {
            // @ts-ignore
            const matches = key.match(headerPatt) || [];
            const newKey = matches[1];
            if (newKey)
                sections.push([newKey, {}]);
        }
        else if (sections.length > 0) {
            const lastIdx = sections.length - 1;
            sections[lastIdx][1][key] = value;
        }
    }
    return sections;
};
exports.splitIntoSections = splitIntoSections;
const sha256 = (str) => crypto_1.default
    .createHash('sha256')
    .update(str)
    .digest('hex');
exports.sha256 = sha256;
const fromCompact = (sigBuffer) => {
    // @ts-ignore
    return Signature.fromCompact(sigBuffer);
};
const verifySignature = (message, compactSignature, pubKey) => {
    try {
        const pubKeyBuffer = Buffer.from(pubKey, 'hex');
        const signatureBuffer = fromCompact(Buffer.from(compactSignature, 'hex')).toBuffer();
        const messageBuffer = Buffer.from(message);
        const res = varuint_bitcoin_1.default.encode(messageBuffer.length);
        const encodedMessage = Buffer.concat([res, messageBuffer], messageBuffer.length + res.length);
        const verified = utils_1.default.verifyMessage(encodedMessage, signatureBuffer, pubKeyBuffer);
        return verified;
    }
    catch (err) {
        // ignore error
        return false;
    }
};
exports.verifySignature = verifySignature;
//# sourceMappingURL=index.js.map