import BitcoreLib from 'bitcore-lib';
import Utils from '../bitcore-wallet-service/src/lib/common/utils';
import dns from 'dns';
import crypto from 'crypto';
import varuint from 'varuint-bitcoin';

const { Signature } = BitcoreLib.crypto;

export const dnsLookup = (hostname: string): Promise<string[]> => new Promise((resolve, reject) => {
  dns.lookup(
    hostname,
    {
      family: 4, // lookup ipv4 addresses
      all: true, // return all addresses
    },
    (err, addresses) => {
      if(err)
        reject(err);
      else
        resolve(addresses.map(a => a.address));
  });
});

export const splitIntoSections = (splitConfig: string[][]): [string, {[key: string]: string}][] => {
  const headerPatt = /\[(.+)]/;
  const sections: [string, {[key: string]: any}][] = [];
  for(const [key, value] of splitConfig) {
    if(headerPatt.test(key)) {
      // @ts-ignore
      const matches = key.match(headerPatt) || [];
      const newKey = matches[1];
      if(newKey)
        sections.push([newKey, {}]);
    } else if(sections.length > 0) {
      const lastIdx = sections.length - 1;
      sections[lastIdx][1][key] = value;
    }
  }
  return sections;
};

export const sha256 = (str: string): string => crypto
  .createHash('sha256')
  .update(str)
  .digest('hex');

const fromCompact = (sigBuffer: Buffer): any => {
  // @ts-ignore
  return Signature.fromCompact(sigBuffer);
};

export const verifySignature = (message: string, compactSignature: string, pubKey: string): boolean => {
  try {
    const pubKeyBuffer = Buffer.from(pubKey, 'hex');
    const signatureBuffer: Buffer = fromCompact(Buffer.from(compactSignature, 'hex')).toBuffer();
    const messageBuffer = Buffer.from(message);
    const res = varuint.encode(messageBuffer.length);
    const encodedMessage = Buffer.concat([res, messageBuffer], messageBuffer.length + res.length);
    const verified: boolean = Utils.verifyMessage(encodedMessage, signatureBuffer, pubKeyBuffer);
    return verified;
  } catch(err) {
    // ignore error
    return false;
  }
};
