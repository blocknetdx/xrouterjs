import bitcore from 'bitcore-lib';
import { NetworkType } from '../constants';
import { blockMainnet } from './block';

bitcore.Networks.add(blockMainnet);

export const Networks = {
  block: {
    [NetworkType.MAINNET]: bitcore.Networks.get('BLOCK Mainnet', ['name']),
  },
};
