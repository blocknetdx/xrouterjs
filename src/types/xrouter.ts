import { NetworkParams } from '../networks/NetworkParams';
import { dnsLookup } from '../util';
import { PeerManager } from 'p2p-manager';
import { Peer } from 'p2p-node';
import request from 'superagent';

interface PeerState {
  inboundPeers: any,
  outbondPeers: any,
  persistentPeers: any,
  banned: any,
  outboundGroups: any,
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
    console.log(1);
    if(XRouter.isNS(service, xr)) {
      console.log(2);
      return service.replace(new RegExp(`^${XRouter.xrNS(xr)}`), '');
    } else if(XRouter.isNS(service, xrs)) {
      return service.replace(new RegExp(`^${XRouter.xrNS(xrs)}`), '');
    }
    return service;
  }

  peerMgr: PeerManager;
  params: NetworkParams;
  started = false;

  _timeout = 30000;
  _log(message: string): void {
    console.log(message);
  }
  _errLog(message: string): void {
    console.error(message);
  }

  constructor(params: NetworkParams, log:(message: string)=>void, errLog:(message: string)=>void) {
    this.params = params;
    const peerMgr = new PeerManager({
      magic: params.networkMagic,
      port: params.port,
      minPeers: 10,
      maxPeers: 100,
    });
    peerMgr.on('error', (res: {severity: string, message: string}): void => {
      this._errLog(`${res.severity}: ${res.message}`);
    });
    peerMgr.on('peerConnect', (res: {peer: Peer}) => {
      this._log('peerConnect: ' + res.peer.getUUID());
    });
    peerMgr.on('peerEnd', (res: {peer: Peer}) => {
      this._log('peerEnd: ' + res.peer.getUUID());
    });
    peerMgr.on('peerMessage', (res: {peer: Peer, command: string}) => {
      this._log('peerMessage' + res.peer.getUUID());
    });
    peerMgr.on('peerError', (res: {peer: Peer, command: string, data: any}) => {
      this._log('peerError' + res.peer.getUUID());
    });
    peerMgr.on('commandMessage', (res: {peer: Peer, command: string}) => {
      this._log('commandMessage' + res.peer.getUUID());
    });
    peerMgr.on('status', (status: {numActive: number, poolSize: number, badPeers: number}) => {
      this.started = status.numActive > 0;
    });
    this.peerMgr = peerMgr;
    if(log)
      this._log = log;
    if(errLog)
      this._errLog = errLog;
  }

  async start(): Promise<boolean> {
    if(!this.started) {
      this._log('Starting XRouter client');

      // Connect to peers
      const { dnsSeeds } = this.params;
      let addresses: string[] = [];
      for(const seed of dnsSeeds) {
        try {
          const res = await dnsLookup(seed);
          addresses = addresses.concat(res);
        } catch(err) {
          this._errLog(`${err.message} \n ${err.stack}`);
        }
      }
      this.peerMgr.addPool(addresses);
      await new Promise((resolve) => {
        const interval = setInterval(() => {
          if(this.started) {
            clearTimeout(timeout);
            clearInterval(interval);
            resolve(this.started);
          } else {
            this.peerMgr.status();
          }
        }, 1000);
        const timeout = setTimeout(() => {
          clearInterval(interval);
          this._errLog('Unable to connect to any peers.');
        }, this._timeout);
      });
    }
    if(this.started)
      this._log('XRouter is ready');
    return this.started;
  }

  async getBlockCount(service: string, query: number): Promise<void> {
    // const ns = XRouter.namespaces.xr;
    // const xrFunc = XRouter.spvCalls.xrGetBlockCount;
    // const nsService = XRouter.addNamespace(service, ns);
    // console.log('nsService', nsService);
    // console.log('nxService', XRouter.removeNamespace(nsService));
    // const endpoint = `/${ns}/${XRouter.removeNamespace(nsService)}/${xrFunc}`;

    // this.peerMgr.send(query, 'state', 'connected', 'xrouterversion', Buffer.from([]), '12345', res => console.log('res', res));

    // this.peerMgr.send(query, 'state', 'connected', 'version', new Buffer(''), '12345', res => console.log('res', res));
    // const responseArr = await Promise.all(Object.values(this.peerMgr.activePeers)
    //   .map(({ host }: Peer) => {
    //     const path = `http://${host.host}:${host.port}${endpoint}`;
    //     console.log('path', path);
    //     return request
    //       .post(path)
    //       .timeout(this._timeout)
    //       .set('Content-Type', 'application/json')
    //       .send([]);
    //   }));
    // console.log(responseArr);
  }

  async callService(command: string, params: any, query: number): Promise<any> {
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
