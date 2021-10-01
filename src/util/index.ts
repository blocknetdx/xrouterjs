import dns from 'dns';
import crypto from 'crypto';

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
