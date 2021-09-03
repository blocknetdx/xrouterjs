import dns from 'dns';
import isNull from "lodash/isNull";

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

export const mostCommonReply = (items: any[]): any => {
  const serializedItems = items
    .map(item => {
      try {
        return JSON.stringify(item);
      } catch(err) {
        return null;
      }
    })
    .reduce((obj: {[key: string]: number}, serialized: string|null) => {
      if(isNull(serialized)) {
        return obj;
      } else if(obj[serialized]) {
        obj[serialized]++;
      } else {
        obj[serialized] = 1;
      }
      return obj;
    }, {});
  const sortedSerialized = Object.keys(serializedItems)
    .sort((a, b) => {
      return a === b ? 0 : a > b ? -1 : 1;
    });
  if(sortedSerialized[0]) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return JSON.parse(sortedSerialized[0]);
    } catch(err) {
      // do nothing
    }
  }
};
