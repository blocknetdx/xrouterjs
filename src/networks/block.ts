import { NetworkParams } from './NetworkParams';

export const blockMainnet: NetworkParams = {
  name: 'BLOCK Mainnet',
  alias: 'block',
  pubkeyhash: 0x1a,
  privatekey: 0x9a,
  scripthash: 0x1c,
  bech32prefix: 'block',
  xpubkey: 0x0488b21e,
  xprivkey: 0x0488ade4,
  networkMagic: 0xa1a0a2a3,
  port: 41412,
  dnsSeeds: [
    'seed1.blocknet.co',
    'seed2.blocknet.co',
    'seed3.blocknet.co',
  ],
};
