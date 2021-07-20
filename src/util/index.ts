import dns from 'dns';

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
