export interface NetworkParams {
  name: string;
  alias: string;
  pubkeyhash: number;
  privatekey: number;
  scripthash: number;
  bech32prefix: string;
  xpubkey: number;
  xprivkey: number;
  networkMagic: number;
  port: number;
  dnsSeeds: string[]
}
