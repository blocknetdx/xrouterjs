import bitcore from 'bitcore-lib';
import { blockMainnet } from './block';
import { NetworkParams } from './network-params';

bitcore.Networks.add(blockMainnet);

export const Networks = {
  MAINNET: bitcore.Networks.get(blockMainnet.name, ['name']) as NetworkParams,
};
