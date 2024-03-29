import { Peer } from 'p2p-node';
import { Pool } from '../bitcore-p2p/lib';
import { ServiceNode, ServiceNodeData } from './service-node';
import { Service } from './service';
import request from 'superagent';
import isNull from 'lodash/isNull';
import isObject from 'lodash/isObject';
import shuffle from 'lodash/shuffle';
import { sha256, splitIntoSections, verifySignature } from '../util';
import uniq from 'lodash/uniq';
import { SnodeReply } from './service-node-reply';
import { EventEmitter } from 'events';
import { NetworkParams } from '../networks/network-params';
import { Networks } from '../networks';

interface XrouterOptions {
  network?: NetworkParams,
  maxPeers?: number;
  maxFee?: number;
  queryNum?: number;
  timeout?: number;
}

const mostCommonReply = (replies: SnodeReply[]): string => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const filtered: SnodeReply[] = replies
    .filter(r => !isNull(r));
  const counts = new Map();
  const values = new Map();
  for(const { hash, reply } of filtered) {
    const count: number = counts.get(hash) || 0;
    counts.set(hash, count + 1);
    values.set(hash, reply);
  }
  const sortedCounts = [...counts.entries()]
    .sort((a, b) => {
      const countA = a[1];
      const countB = b[1];
      return countA === countB ? 0 : countA > countB ? -1 : 1;
    });
  const topHash = sortedCounts[0][0];
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return values.get(topHash) || '';
};

export class XRouter extends EventEmitter {

  static networks = {
    MAINNET: Networks.MAINNET,
  };

  static events = {
    INFO: 'INFO',
    ERROR: 'ERROR',
  };

  static namespaces = {
    xr: 'xr', // xrouter
    xrs: 'xrs', // xrouter service
    xrd: 'xrd', // xrouter domain
    xrdelim: '::',
  };

  static spvCalls = {
    xrGetBlockCount: 'xrGetBlockCount',
    xrGetBlockHash: 'xrGetBlockHash',
    xrGetBlock: 'xrGetBlock',
    xrGetBlocks: 'xrGetBlocks',
    xrGetTransaction: 'xrGetTransaction',
    xrGetTransactions: 'xrGetTransactions',
    xrDecodeRawTransaction: 'xrDecodeRawTransaction',
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
  network: NetworkParams;
  started = false;
  ready = false;
  snodes: ServiceNode[] = [];
  queryNum: number;
  maxFee: number;
  timeout: number;
  maxPeers: number;
  _timeout = 30000;
  _inspectInterval: any;

  private logInfo(message: string): void {
    this.emit(XRouter.events.INFO, message);
  }

  private logErr(message: string): void {
    this.emit(XRouter.events.ERROR, message);
  }

  constructor(options: XrouterOptions = {}) {
    super();
    const {
      network = XRouter.networks.MAINNET,
      maxPeers = 8,
      maxFee = 0,
      queryNum = 5,
      timeout = 10000,
    } = options;
    this.maxPeers = maxPeers;
    this.maxFee = maxFee;
    this.queryNum = queryNum;
    this.timeout = timeout;
    this.network = network;
    const peerMgr: Pool = new Pool({
      network: network.name,
      maxSize: maxPeers,
    });
    peerMgr.on('peerconnect', (peer: Peer) => {
      this.logInfo(`Connected to ${peer.host}`);
    });
    peerMgr.on('peerdisconnect', (peer: Peer) => {
      this.logInfo(`Disconnected from ${peer.host}`);
      this.started = peerMgr.numberConnected() > 0;
    });
    peerMgr.on('peersnp', (peer: Peer, message: any) => {
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
        const mainIdx = sections.findIndex((arr) => arr[0] === 'Main');
        if(mainIdx < 0) return;
        const mainSection = sections[mainIdx];
        const serviceSections = sections.filter((a, i) => i !== mainIdx);
        const xrouterVersion = message.config.xrouterversion;
        const {
          // main specific
          host,
          port: portStr = '0',
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
        const port = Number(portStr)|| this.network.port;
        const serviceNodeData: ServiceNodeData = {
          pubKey,
          host,
          port,
          wallets: wallets.split(',').map(s => s.trim()).filter(s => s),
          plugins: plugins !== '0' ? plugins.split(',').map(s => s.trim()).filter(s => s) : [],
          xrouterVersion,
          fee,
          clientRequestLimit: Number(clientRequestLimit),
          fetchLimit: Number(fetchLimit),
          paymentAddress,
          tls: tls === 'true' || tls === '1',
          services: [],
          exrCompatible: port !== this.network.port,
          lastPingTime: pingTime,
        };
        const idx = this.snodes.findIndex(n => n.pubKey === pubKey);
        let sn: ServiceNode;
        if(idx > 0) {
          sn = this.snodes[idx];
          for(const key of Object.keys(serviceNodeData)) {
            // @ts-ignore
            sn[key] = serviceNodeData[key];
          }
        } else {
          sn = new ServiceNode(serviceNodeData);
          sn.on('INFO', this.logInfo.bind(this));
        }
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

        for(const svc of Object.values(serviceInstances)) {
          if(!svc.disabled)
            sn.addService(svc);
        }
        if(idx >= 0) {
          this.snodes[idx] = sn;
        } else {
          this.snodes.push(sn);
        }
      }
      this.started = true;
    });

    this.peerMgr = peerMgr;
  }

  async start(): Promise<boolean> {
    if(!this.started) {
      this.logInfo('Starting XRouter client');

      this._inspectInterval = setInterval(() => {
        this.logInfo(JSON.stringify(this.status()));
        // this.logInfo(this.peerMgr.inspect());
      }, 60000);

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
          this.logErr('Unable to connect to any peers.');
        }, this._timeout);
      });
    }
    if(this.started) {
      this.logInfo('XRouter started');
      await new Promise<void>(resolve => {
        const nodeCountInterval = setInterval(() => {
          if(this.exrNodeCount() >= this.queryNum) {
            clearInterval(nodeCountInterval);
            resolve();
          }
        }, 1000);
      });
      this.ready = true;
      this.logInfo('XRouter is ready');
    }

    return this.ready;
  }

  stop(): void {
    this.logInfo('Stopping XRouter');
    this.started = false;
    this.ready = false;
    this.snodes.forEach(s => s.close());
    this.snodes = [];
    // @ts-ignore
    this.peerMgr.disconnect();
    clearInterval(this._inspectInterval);
  }

  isStarted(): boolean {
    return this.started;
  }

  isReady(): boolean {
    return this.ready;
  }

  status(): {connectedPeers: number, totalPeers: number, exrNodes: number, totalXRNodes: number} {
    const { peerMgr } = this;
    return {
      connectedPeers: peerMgr.numberConnected(),
      totalPeers: peerMgr._addrs.length,
      exrNodes: this.exrNodeCount(),
      totalXRNodes: this.snodes.length,
    };
  }

  exrNodeCount(): number {
    return this.snodes.filter(sn => sn.exrCompatible).length;
  }

  combineWithDelim(str1: string, str2: string): string {
    return str1 + XRouter.namespaces.xrdelim + str2;
  }

  getSnodesByXrService(namespace: string, serviceName: string): ServiceNode[] {
    return this.snodes
      .filter(sn => sn.hasService(namespace, serviceName, this.maxFee));
  }

  async getBlockCountRaw(wallet: string, query = this.queryNum): Promise<SnodeReply[]> {
    const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrGetBlockCount);
    return await this._callService(
      XRouter.namespaces.xr,
      serviceName,
      [],
      query
    );
  }

  async getBlockCount(wallet: string, query = this.queryNum): Promise<string> {
    const res = await this.getBlockCountRaw(wallet, query);
    return mostCommonReply(res);
  }

  async getBlockHashRaw(wallet: string, blockNumber: number, query = this.queryNum): Promise<SnodeReply[]> {
    const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrGetBlockHash);
    return await this._callService(
      XRouter.namespaces.xr,
      serviceName,
      [blockNumber],
      query
    );
  }

  async getBlockHash(wallet: string, blockNumber: number, query = this.queryNum): Promise<string> {
    const res = await this.getBlockHashRaw(wallet, blockNumber, query);
    return mostCommonReply(res);
  }

  async getBlockRaw(wallet: string, blockHash: string, query = this.queryNum): Promise<SnodeReply[]> {
    const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrGetBlock);
    return await this._callService(
      XRouter.namespaces.xr,
      serviceName,
      [blockHash],
      query
    );
  }

  async getBlock(wallet: string, blockHash: string, query = this.queryNum): Promise<string> {
    const res = await this.getBlockRaw(wallet, blockHash, query);
    return mostCommonReply(res);
  }

  async getBlocksRaw(wallet: string, blockHashes: string[], query = this.queryNum): Promise<SnodeReply[]> {
    const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrGetBlocks);
    return await this._callService(
      XRouter.namespaces.xr,
      serviceName,
      [...blockHashes],
      query
    );
  }

  async getBlocks(wallet: string, blockHashes: string[], query = this.queryNum): Promise<string> {
    const res = await this.getBlocksRaw(wallet, blockHashes, query);
    return mostCommonReply(res);
  }

  async getTransactionRaw(wallet: string, txid: string, query = this.queryNum): Promise<SnodeReply[]> {
    const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrGetTransaction);
    return await this._callService(
      XRouter.namespaces.xr,
      serviceName,
      [txid],
      query
    );
  }

  async getTransaction(wallet: string, txid: string, query = this.queryNum): Promise<string> {
    const res = await this.getTransactionRaw(wallet, txid, query);
    return mostCommonReply(res);
  }

  async getTransactionsRaw(wallet: string, txids: string[], query = this.queryNum): Promise<SnodeReply[]> {
    const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrGetTransactions);
    return await this._callService(
      XRouter.namespaces.xr,
      serviceName,
      [...txids],
      query
    );
  }

  async getTransactions(wallet: string, txids: string[], query = this.queryNum): Promise<string> {
    const res = await this.getTransactionsRaw(wallet, txids, query);
    return mostCommonReply(res);
  }

  async sendTransactionRaw(wallet: string, signedTx: string, query = 1): Promise<SnodeReply[]> {
    const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrSendTransaction);
    return await this._callService(
      XRouter.namespaces.xr,
      serviceName,
      [signedTx],
      query
    );
  }

  async sendTransaction(wallet: string, signedTx: string, query = 1): Promise<string> {
    const res = await this.sendTransactionRaw(wallet, signedTx, query);
    return mostCommonReply(res);
  }

  async decodeTransactionRaw(wallet: string, signedTx: string, query = this.queryNum): Promise<SnodeReply[]> {
    const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrDecodeRawTransaction);
    return await this._callService(
      XRouter.namespaces.xr,
      serviceName,
      [signedTx],
      query
    );
  }

  async decodeTransaction(wallet: string, signedTx: string, query = this.queryNum): Promise<string> {
    const res = await this.decodeTransactionRaw(wallet, signedTx, query);
    return mostCommonReply(res);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async callServiceRaw(service: string, params: any, query = this.queryNum): Promise<SnodeReply[]> {
    return await this._callService(
      XRouter.namespaces.xrs,
      service,
      params,
      query
    );
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async callService(service: string, params: any, query: number): Promise<string> {
    const res = await this.callServiceRaw(service, params, query);
    return mostCommonReply(res);
  }

  async _callService(namespace: string, serviceName: string, params: any[], query: number): Promise<SnodeReply[]> {

    this.logInfo(`call service ${serviceName}`);
    const snodes = this.getSnodesByXrService(namespace, serviceName);
    this.logInfo(`${snodes.length} snodes serving ${serviceName}`);
    const filteredSnodes: ServiceNode[] = shuffle(snodes)
      .filter(snode => {
        return snode.isReady();
      });
    this.logInfo(`${filteredSnodes.length} snodes ready for ${serviceName}`);
    const responseArr = [];
    for(const snode of filteredSnodes) {
      const reply = await new Promise<SnodeReply|null>(resolve => {
        let path = '';
        if(namespace === XRouter.namespaces.xr) {
          const [ wallet, xrFunc ] = serviceName.split(XRouter.namespaces.xrdelim);
          path = `${snode.endpoint()}/${namespace}/${wallet}/${xrFunc}`;
        } else if(namespace === XRouter.namespaces.xrs) {
          path = `${snode.endpoint()}/${namespace}/${serviceName}`;
        }
        const jsonPayload = JSON.stringify(params);
        this.logInfo(`POST to ${path} with params ${jsonPayload}`);
        request
          .post(path)
          .set('Content-Type', 'application/json')
          .send(jsonPayload)
          .buffer(true)
          .parse((res, cb) => {
            let text = '';
            res.on('data', buf => {
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              text = `${text}${buf.toString()}`;
            });
            res.on('end', () => {
              Object.assign(res, {text});
              cb(null, res);
            });
          })
          .timeout(this.timeout)
          .then(res => {
            snode.lastRequestTime = Date.now();
            const { text = '' } = res;
            const xrPubKey = res.headers['xr-pubkey'];
            const xrSignature = res.headers['xr-signature'];
            const verified = xrPubKey === snode.pubKey && verifySignature(text, xrSignature, xrPubKey);
            if(!verified) {
              snode.downgradeStatus();
              throw new Error(`Response signature from ${path} could not be verified.`);
            }
            try {
              this.logInfo(`${serviceName} response from ${snode.host} ${text}`);
            } catch(err) {
              // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
              // @ts-ignore
              this.logErr(err.message + '\n' + err.stack);
            }
            resolve(new SnodeReply(snode.pubKey, sha256(text), text));
          })
          .catch(err => {
            snode.lastRequestTime = Date.now();
            if(/Timeout/.test(err.message)) {
              snode.downgradeStatus();
            } else {
              // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
              this.logErr(err.message + '\n' + err.stack);
            }
            resolve(null);
          });
      });
      if(isObject(reply)) {
        responseArr.push(reply);
        if(responseArr.length === query)
          break;
      }
    }
    if(responseArr.length < query)
      throw new Error(`Responses returned from only ${responseArr.length} out of the required ${query} nodes.`);
    return responseArr;
  }

}
