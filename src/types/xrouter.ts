import { NetworkParams } from '../networks/NetworkParams';
import { Peer } from 'p2p-node';
import { Pool } from '../bitcore-p2p/lib';
import {ServiceNode, ServiceNodeData} from './service-node';

// import { dnsLookup } from '../util';
// import { PeerManager } from 'p2p-manager';
// import request from 'superagent';
// import shuffle from 'lodash/shuffle';
// import uniq from 'lodash/uniq';
// import { ServiceNode } from './service-node';

// interface PeerState {
//   inboundPeers: any,
//   outbondPeers: any,
//   persistentPeers: any,
//   banned: any,
//   outboundGroups: any,
// }

interface XrouterOptions {
  maxPeers: number;
}

export class XRouter {

  static namespaces = {
    xr: 'xr',
    xrs: 'xrs',
    xrd: 'xrd',
    xrdelim: '::',
  };

  static spvCalls = {
    xrGetBlockCount: 'xrGetBlockCount',
    xrGetBlockHash: 'xrGetBlockHash',
    xrGetBlock: 'xrGetBlock',
    xrGetBlocks: 'xrGetBlocks',
    xrGetTransaction: 'xrGetTransaction',
    xrGetTransactions: 'xrGetTransactions',
    xrDecodeTransaction: 'xrDecodeTransaction',
    xrSendTransaction: 'xrSendTransaction',
  };

  static otherCalls = {
    xrService: 'xrService',
  };

  static xrNS(ns: string): string {
    return ns + XRouter.namespaces.xrdelim;
  }

  static isNS(service: string, ns: string): boolean {
    const patt = new RegExp('^' + XRouter.xrNS(ns));
    return patt.test(service);
  }

  static addNamespace(service: string, ns: string): string {
    if(!XRouter.isNS(service, ns)) {
      return XRouter.xrNS(ns) + service;
    }
    return service;
  }

  static removeNamespace(service: string): string {
    const { xr, xrs } = XRouter.namespaces;
    if(XRouter.isNS(service, xr)) {
      return service.replace(new RegExp(`^${XRouter.xrNS(xr)}`), '');
    } else if(XRouter.isNS(service, xrs)) {
      return service.replace(new RegExp(`^${XRouter.xrNS(xrs)}`), '');
    }
    return service;
  }

  peerMgr: Pool;
  params: NetworkParams;
  started = false;
  snodes: ServiceNode[] = [];

  _timeout = 30000;
  _log(message: string): void {
    console.log(message);
  }
  _errLog(message: string): void {
    console.error(message);
  }

  constructor(params: NetworkParams, options: XrouterOptions, log:(message: string)=>void, errLog:(message: string)=>void) {
    const { maxPeers = 8 } = options;
    this.params = params;
    const peerMgr: Pool = new Pool({
      maxSize: maxPeers,
    });
    peerMgr.on('peerconnect', (peer: Peer) => {
      this._log(`Connect! ${peer.host}`);
    });
    peerMgr.on('peerdisconnect', (peer: Peer) => {
      console.log(`Disconnect. ${peer.host}`);
      this.started = peerMgr.numberConnected() > 0;
    });
    peerMgr.on('peersnp', (peer: Peer, message: any) => {
      // console.log('snp', message);
      if(message.config && message.config.xrouter && message.config.xrouter.config) {
        const splitConfig: string[][] = message.config.xrouter.config
          .split('\n')
          .map((s: string) => s.trim())
          .filter((s: string) => s)
          .filter((s: string) => !/^#/.test(s))
          .map((s: string): string[] => s.split('=').map(ss => ss.trim()));
        const configStr = message.config.xrouter;
        const hostIdx = splitConfig.findIndex((a: string[]) => a[0] === 'host');
        const host = hostIdx >= 0 && splitConfig[hostIdx][1] ? splitConfig[hostIdx][1] : '';
        if(!host) return;
        const portIdx = splitConfig.findIndex((a: string[]) => a[0] === 'port');
        const port = portIdx >= 0 && splitConfig[portIdx][1] ? Number(splitConfig[portIdx][1]) : 0;
        const walletsIdx = splitConfig.findIndex((a: string[]) => a[0] === 'wallets');
        const wallets = walletsIdx >= 0 && splitConfig[walletsIdx][1] ? splitConfig[walletsIdx][1].split(',').map(s => s.trim()).filter(s => s) : [];
        const mainIdx = splitConfig.findIndex((a: string[]) => a[0] === '[Main]');
        let fee = 0;
        for(let i = mainIdx; i < splitConfig.length; i++) {
          if(/\[.+]/.test(splitConfig[i][0])) break;
          if(splitConfig[i][0] === 'fee' && splitConfig[i][1]) {
            fee = Number(splitConfig[i][1]);
          }
        }
        const xrouterVersion = message.config.xrouterversion;
        const serviceNodeData: ServiceNodeData = {
          pubKey: message.pubKey.toString('hex'),
          host,
          port,
          wallets,
          configStr,
          xrouterVersion,
        };
        const sn = new ServiceNode(serviceNodeData);
        const idx = this.snodes.findIndex(n => n.pubKey === sn.pubKey);
        if(idx >= 0) {
          this.snodes[idx] = sn;
        } else {
          console.log(sn);
          this.snodes.push(sn);
        }
      }
      this.started = true;
    });

    this.peerMgr = peerMgr;

    // const peerMgr = new PeerManager({
    //   magic: params.networkMagic,
    //   port: params.port,
    //   minPeers: 10,
    //   maxPeers: 1000,
    // });
    // peerMgr.on('error', (res: {severity: string, message: string}): void => {
    //   this._errLog(`${res.severity}: ${res.message}`);
    // });
    // peerMgr.on('peerConnect', (res: {peer: any}) => {
    //   // console.log(res.peer);
    //   const { host } = res.peer;
    //   console.log(host.host + ':' + host.port);
    //   // this._log('peerConnect: ' + res.peer.host + ' ' + res.peer.port);
    //   // this._log('peerConnect: ' + res.peer.getUUID());
    //   // setInterval(() => {
    //   //   console.log(res.peer.inbound.toString());
    //   // }, 1000);
    //   const { peer } = res;
    //   peer.on('connect', (d: any): void => {
    //     console.log(d);
    //   });
    //   peer.on('snp', (d: any): void => {
    //     console.error('snp', d.peer.getUUID());
    //   });
    //   peer.on('snr', (d: any): void => {
    //     console.error('snr', d.peer.getUUID());
    //   });
    //   peer.on('end', (d: any): void => {
    //     console.error('end', d.peer.getUUID());
    //   });
    //   peer.on('error', (d: any): void => {
    //     console.log('error', d.error);
    //   });
    //   peer.on('pong', (d: any): void => {
    //     console.error('pong', d);
    //   });
    //   peer.on('data', (d: any): void => {
    //     console.error('data', d);
    //   });
    //   peer.on('message', (res: {peer: Peer, command: string}) => {
    //     this._log('message' + res);
    //   });
    //   // peer.send('snr', undefined, (res: any): void => {
    //   //   console.log('res', res);
    //   // });
    //   const payload = JSON.stringify({
    //     version: 7000,
    //     services: Buffer(8).fill(0),
    //     timestamp: Math.round(Date.now() / 1000),
    //     receiverAddress: {
    //       services: Buffer('0100000000000000', 'hex'),
    //       address: '0.0.0.0',
    //       port: 8333
    //     },
    //     senderAddress: {
    //       services: Buffer(8).fill(0),
    //       address: '0.0.0.0',
    //       port: 8333
    //     },
    //     nonce: Buffer(8).fill(123),
    //     userAgent: 'Node P2P',
    //     startHeight: 0,
    //     relay: true,
    //   });
    //   peer.send('version', payload, (res: any): void => {
    //     console.log('res', res);
    //   });
    // });
    // peerMgr.on('peerEnd', (res: {peer: Peer}) => {
    //   this._log('peerEnd: ' + res.peer.getUUID());
    // });
    // peerMgr.on('peerMessage', (res: {peer: Peer, command: string}) => {
    //   this._log('peerMessage' + res.peer.getUUID());
    // });
    // peerMgr.on('peerError', (res: {peer: Peer, command: string, data: any}) => {
    //   this._log('peerError' + res.peer.getUUID());
    // });
    // peerMgr.on('commandMessage', (res: {peer: Peer, command: string}) => {
    //   this._log('commandMessage' + res.peer.getUUID());
    // });
    // peerMgr.on('getXRNodeConfig', (status: {numActive: number, poolSize: number, badPeers: any}) => {
    //   this.started = status.numActive > 0;
    //   console.log(`numActive: ${status.numActive}, poolSize: ${status.poolSize}, badPeers: ${Object.keys(status.badPeers).length}`);
    //   // console.log(Object.keys(status.badPeers).length);
    // });
    // this.peerMgr = peerMgr;
    if(log)
      this._log = log;
    if(errLog)
      this._errLog = errLog;
  }

  async start(): Promise<boolean> {
    if(!this.started) {
      this._log('Starting XRouter client');

      // Connect to peers
      // const { dnsSeeds } = this.params;
      // let addresses: string[] = [];
      // for(const seed of dnsSeeds) {
      //   try {
      //     const res = await dnsLookup(seed);
      //     addresses = addresses.concat(res);
      //   } catch(err) {
      //     this._errLog(`${err.message} \n ${err.stack}`);
      //   }
      // }
      // console.log(addresses);
      // this.peerMgr.addPool(addresses);

      setInterval(() => {
        this._log(this.peerMgr.inspect());
      }, 5000);

      this.peerMgr.connect();

      await new Promise((resolve) => {
        const interval = setInterval(() => {
          if(this.started) {
            clearTimeout(timeout);
            clearInterval(interval);
            resolve(this.started);
          }
        }, 2000);
        const timeout = setTimeout(() => {
          clearInterval(interval);
          this._errLog('Unable to connect to any peers.');
        }, this._timeout);
      });
    }
    if(this.started) {
      this._log('XRouter is ready');
    }

    return this.started;
  }

  // getAvailableServices(wallet: string): Promise<string[]> {
  //   const peers = this.peerMgr.activePeers();
  //   let availableServices: string[] = [];
  //   for(const peer of peers) {
  //     const { splitXrouterConfig = [] } = peer;
  //     const walletsIdx: number = splitXrouterConfig.findIndex((arr: [string]) => arr[0] === 'wallets');
  //     if(walletsIdx < 0) continue;
  //     const wallets: string[] = (splitXrouterConfig[walletsIdx][1] || '')
  //       .split(',')
  //       .map((w: string) => w.trim())
  //       .filter((w: string) => w);
  //     if(wallets.includes(wallet)) {
  //       const servicePatt = /^\[(.+)]$/;
  //       const services: string[] = splitXrouterConfig
  //         .slice(walletsIdx + 1)
  //         .map((a: string[]) => a[0] || '')
  //         .filter((s: string) => s)
  //         .filter((s: string) => servicePatt.test(s))
  //         .map((s: string) => s.replace(servicePatt, '$1'));
  //       availableServices = availableServices.concat(services);
  //     }
  //   }
  //   return uniq(availableServices);
  // }

  // getAvailableWallets(): [string, Peer[]][] {
  //   const peers = this.peerMgr.activePeers()
  //     .filter((p: Peer) => p.xrHost && p.xrPort);
  //   // let availableWallets: [string, Peer[]][] = [];
  //   const availableWallets: any = {};
  //   for(const peer of peers) {
  //     const { splitXrouterConfig = [] } = peer;
  //     const walletsIdx: number = splitXrouterConfig.findIndex((arr: [string]) => arr[0] === 'wallets');
  //     if(walletsIdx < 0) continue;
  //     const wallets: string[] = (splitXrouterConfig[walletsIdx][1] || '')
  //       .split(',')
  //       .map((w: string) => w.trim())
  //       .filter((w: string) => w);
  //     for(const wallet of wallets) {
  //       const availablePeers = availableWallets[wallet] || [];
  //       availableWallets[wallet] = [...availablePeers, peer];
  //     }
  //   }
  //   return Object.keys(availableWallets)
  //     .map(wallet => [wallet, availableWallets[wallet]]);
  // }

  // async getBlockCount(service: string, query = 5): Promise<number> {
  //   const ns = XRouter.namespaces.xr;
  //   const xrFunc = XRouter.spvCalls.xrGetBlockCount;
  //   const nsService = XRouter.addNamespace(service, ns);
  //   const wallet = nsService.split('::')[1];
  //   // console.log('nsService', nsService);
  //   // console.log('nxService', XRouter.removeNamespace(nsService));
  //   const availableWallets = this.getAvailableWallets();
  //   const found = availableWallets.find(w => w[0] === wallet) || [];
  //   const peers = found[1] || [];
  //   // console.log('peers', peers);
  //   // const shuffled = shuffle(peers).slice(0, query);
  //   const shuffled = peers;
  //   // console.log('shuffled', shuffled);
  //   shuffled.forEach((p: Peer) => console.log(p.host, p.xrHost, p.splitXrouterConfig.length));
  //   const responses = await Promise.all(shuffled.map((peer: Peer) => new Promise(resolve => {
  //     // const { body }: {body: {error: any, id: string, result: {reply: number, uuid: string}}} = await request
  //     const responses = [];
  //     // console.log(`http://${peer.xrHost}:${peer.xrPort}`);
  //     // request
  //     //   .post(`http://${peer.xrHost}:${peer.xrPort}`)
  //     //   // .auth('BlockDXBlocknet', '217691ec-4cce-4f50-b397-ab9acbf1540d')
  //     //   .send({
  //     //     id: '',
  //     //     method: xrFunc,
  //     //     params: [nsService, query],
  //     //   })
  //     //   .then((res): void => {
  //     //     const { body } = res;
  //     //     resolve(0);
  //     //   })
  //     //   .catch(err => {
  //     //     console.error(err);
  //     //     resolve(0);
  //     //   });
  //     resolve(0);
  //   })));
  //
  //   console.log(responses);
  //
  //   return 0;
  //
  //   // const endpoint = `/${ns}/${XRouter.removeNamespace(nsService)}/${xrFunc}`;
  //
  //   // this.peerMgr.send(query, 'state', 'connected', 'xrouterversion', Buffer.from([]), '12345', res => console.log('res', res));
  //
  //   // this.peerMgr.send(query, 'state', 'connected', 'version', new Buffer(''), '12345', res => console.log('res', res));
  //   // const responseArr = await Promise.all(Object.values(this.peerMgr.activePeers)
  //   //   .map(({ host }: Peer) => {
  //   //     const path = `http://${host.host}:${host.port}${endpoint}`;
  //   //     console.log('path', path);
  //   //     return request
  //   //       .post(path)
  //   //       .timeout(this._timeout)
  //   //       .set('Content-Type', 'application/json')
  //   //       .send([]);
  //   //   }));
  //   // console.log(responseArr);
  // }

  async callService(command: string, params: any, query: number): Promise<any> {
    // if(staticServiceNodes.length > 0) { // only use provided endpoints
    //   const sliced = shuffle(staticServiceNodes).slice(0, query);
    //   const res = await Promise.all(sliced
    //     .map(sn => new Promise(resolve => {
          // const { body }: {body: {error: any, id: string, result: {reply: number, uuid: string}}} =
          // request
          //   .post('127.0.0.1:41414')
          //   .auth('BlockDXBlocknet', '217691ec-4cce-4f50-b397-ab9acbf1540d')
          //   .send({
          //     id: '',
          //     method: xrFunc,
          //     params: [nsService, query],
          //   });
        // })));
    // } else { // use peer pool

    // }
    // if(noEXR) { // do not connect via EXR
      // const shuffled = shuffle(staticEndpoints);

    // } else { // connect via EXR

    // }
    // console.log(this.peerMgr.activePeers);
    // console.log(Object.values(this.peerMgr.activePeers).map(({ host }: Peer) => `${host.host}:${host.port}`));

    // console.log(Object.values(this.peerMgr.activePeers).map((p: Peer) => p.state));

    // this.peerMgr.send(query, 'state', 'connected', 'xrGetConfig', Buffer.from(''), '12345', res => console.log('res', res));

    // const responseArr = await Promise.all(Object.values(this.peerMgr.activePeers)
    //   .map(({ host }: Peer) => {
    //     const path = `http://${host.host}:${host.port}/${command}`;
    //     console.log('path', path);
    //     return request
    //       .post(path)
    //       .set('Content-Type', 'application/json')
    //       .send(JSON.stringify(params));
    //   }));
    // console.log(responseArr);
  }

}
