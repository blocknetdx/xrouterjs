import { NetworkParams } from '../networks/NetworkParams';
import { Peer } from 'p2p-node';
import { Pool } from '../bitcore-p2p/lib';
import { ServiceNode, ServiceNodeData } from './service-node';
import { Service } from "./service";

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

const headerPatt = /\[(.+)]/;
const splitIntoSections = (splitConfig: string[][]): [string, {[key: string]: string}][] => {
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
        const { pubKey: pubKeyRaw, pingTime } = message;
        const pubKey = pubKeyRaw.toString('hex');
        if(this.snodes.some(snode => snode.pubKey === pubKey && snode.lastPingTime === pingTime))
          return;
        const splitConfig: string[][] = message.config.xrouter.config
          .split('\n')
          .map((s: string) => s.trim())
          .filter((s: string) => s)
          .filter((s: string) => !/^#/.test(s))
          .map((s: string): string[] => s.split('=').map(ss => ss.trim()));
        const sections = splitIntoSections(splitConfig);
        // console.log(sections);
        // const configStr = message.config.xrouter;
        // console.log('configStr', configStr);
        const mainIdx = sections.findIndex((arr) => arr[0] === 'Main');
        if(mainIdx < 0) return;
        const mainSection = sections[mainIdx];
        const serviceSections = sections.filter((a, i) => i !== mainIdx);
        const xrouterVersion = message.config.xrouterversion;
        const {
          // main specific
          host,
          port = '0',
          wallets,
          paymentaddress: paymentAddress,
          plugins = '',
          // shared with services
          clientrequestlimit: clientRequestLimit = '0',
          fee,
          fetchlimit: fetchLimit = '0',
          tls = '0',
        } = mainSection[1];
        if(!host) return;
        const serviceNodeData: ServiceNodeData = {
          pubKey,
          host,
          port: Number(port) || this.params.port,
          wallets: wallets.split(',').map(s => s.trim()).filter(s => s),
          plugins: plugins !== '0' ? plugins.split(',').map(s => s.trim()).filter(s => s) : [],
          xrouterVersion,
          fee,
          clientRequestLimit: Number(clientRequestLimit),
          fetchLimit: Number(fetchLimit),
          paymentAddress,
          tls: tls === 'true' || tls === '1',
          services: [],
          exrCompatible: false,
          lastPingTime: pingTime,
        };
        const sn = new ServiceNode(serviceNodeData);
        const serviceInstances = serviceSections
          .map(([name, options]) => new Service({
            name,
            clientRequestLimit: options.clientrequestlimit ? Number(options.clientrequestlimit) : serviceNodeData.clientRequestLimit,
            fetchLimit: options.fetchlimit ? Number(options.fetchLimit) : serviceNodeData.fetchLimit,
            disabled: options.disabled && options.disabled === '0' ? true : false,
            fee: options.fee || sn.fee,
            help: options.help,
          }))
          .reduce((obj: {[name: string]: Service}, svc: Service) => {
            obj[svc.name] = svc;
            return obj;
          }, {});

        for(const wallet of sn.wallets) {
          for(const method of Object.keys(XRouter.spvCalls)) {
            const combined = `${wallet.toUpperCase()}::${method}`;
            if(!serviceInstances[combined]) { // if the service isn't already in the list
              if (serviceInstances[method]) { // if the method is already in the list
                serviceInstances[combined] = new Service({
                  ...serviceInstances[method],
                  name: combined,
                });
              } else {
                serviceInstances[combined] = new Service({
                  name: combined,
                  clientRequestLimit: sn.clientRequestLimit,
                  fetchLimit: sn.fetchLimit,
                  fee: sn.fee,
                  help: '',
                  disabled: false,
                });
              }
            }
          }
        }

        for(const plugin of sn.plugins) {
          const combined = `xrs::${plugin}`;
          if(!serviceInstances[combined]) { // if the service isn't already in the list
            serviceInstances[combined] = new Service({
              name: combined,
              clientRequestLimit: sn.clientRequestLimit,
              fetchLimit: sn.fetchLimit,
              fee: sn.fee,
              help: '',
              disabled: false,
            });
          }
        }

        sn.services = Object.values(serviceInstances)
          .filter(svc => !svc.disabled);

        const idx = this.snodes.findIndex(n => n.pubKey === sn.pubKey);
        if(idx >= 0) {
          this.snodes[idx] = sn;
        } else {
          // console.log(sn);
          this.snodes.push(sn);
        }
      }
      this.started = true;
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

      setInterval(() => {
        this._log(this.peerMgr.inspect());
      }, 10000);

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
