import { NetworkParams } from '../networks/NetworkParams';
import { Peer } from 'p2p-node';
import { Pool } from '../bitcore-p2p/lib';
import { ServiceNode, ServiceNodeData } from './service-node';
import { Service } from './service';
import request from 'superagent';
import isNull from 'lodash/isNull';
import isObject from 'lodash/isObject';
import shuffle from 'lodash/shuffle';
import { sha256, splitIntoSections, verifySignature } from '../util';
import { blockMainnet } from '../networks/block';
import uniq from 'lodash/uniq';

interface SnodeReply {
  pubKey: string;
  hash: string;
  reply: string;
}

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
  params: NetworkParams;
  started = false;
  ready = false;
  snodes: ServiceNode[] = [];
  queryNum: number;
  maxFee: number;
  timeout: number;
  maxPeers: number;
  _timeout = 30000;

  _logInfo(message: string): void {
    console.log(message);
  }
  _logErr(message: string): void {
    console.error(message);
  }

  constructor(options: XrouterOptions, logInfo:(message: string)=>void, logErr:(message: string)=>void) {
    const {
      network = blockMainnet,
      maxPeers = 8,
      maxFee = 0,
      queryNum = 5,
      timeout = 10000,
    } = options;
    this.maxPeers = maxPeers;
    this.maxFee = maxFee;
    this.queryNum = queryNum;
    this.timeout = timeout;
    this.params = network;
    const peerMgr: Pool = new Pool({
      maxSize: maxPeers,
    });
    peerMgr.on('peerconnect', (peer: Peer) => {
      this._logInfo(`Connected to ${peer.host}`);
    });
    peerMgr.on('peerdisconnect', (peer: Peer) => {
      this._logInfo(`Disconnected from ${peer.host}`);
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
        const port = Number(portStr)|| this.params.port;
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
          exrCompatible: port !== this.params.port,
          lastPingTime: pingTime,
        };
        const idx = this.snodes.findIndex(n => n.pubKey === pubKey);
        const sn = new ServiceNode({
          ...(idx >= 0 ? this.snodes[idx] : {}),
          ...serviceNodeData,
        });
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

    if(logInfo)
      this._logInfo = logInfo;
    if(logErr)
      this._logErr = logErr;
  }

  async start(): Promise<boolean> {
    if(!this.started) {
      this._logInfo('Starting XRouter client');

      setInterval(() => {
        this._logInfo(this.peerMgr.inspect());
      }, 30000);

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
          this._logErr('Unable to connect to any peers.');
        }, this._timeout);
      });
    }
    if(this.started) {
      this._logInfo('XRouter started');
      await new Promise<void>(resolve => {
        const nodeCountInterval = setInterval(() => {
          if(this.exrNodeCount() > 1) {
            clearInterval(nodeCountInterval);
            resolve();
          }
        }, 1000);
      });
      this.ready = true;
      this._logInfo('XRouter is ready');
    }

    return this.ready;
  }

  exrNodeCount(): number {
    return this.snodes.filter(sn => sn.exrCompatible).length;
  }

  combineWithDelim(str1: string, str2: string): string {
    return str1 + XRouter.namespaces.xrdelim + str2;
  }

  getSnodesByXrService(serviceName: string): ServiceNode[] {
    return this.snodes
      .filter(sn => sn.hasService(serviceName, this.maxFee));
  }

  listAllAvailableServices() {
    const { snodes } = this;
    const exrSnodes = snodes
      .filter(sn => sn.exrCompatible);
    return exrSnodes
      .reduce((map, sn) => {
        const { services, wallets } = sn;
        for(const s of services) {
          const splitName = s.name.split('::');
          const toAdd = [];
          if(splitName.length > 1) {
            toAdd.push([splitName[0], splitName[1]]);
          } else {
            for(const wallet of wallets) {
              toAdd.push([wallet, splitName[0]]);
            }
          }
          for(const [wallet, name] of toAdd) {
            const prevServices = map.get(wallet) || [];
            map.set(wallet, uniq([
              ...prevServices,
              name,
            ]).sort());
          }
        }
        return map;
      }, new Map());
  }

  async getBlockCount(wallet: string, query = this.queryNum): Promise<string> {
    const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrGetBlockCount);
    return await this.callService(
      XRouter.namespaces.xr,
      serviceName,
      [],
      query
    );
  }

  async getBlockHash(wallet: string, blockNumber: number, query = this.queryNum): Promise<string> {
    const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrGetBlockHash);
    return await this.callService(
      XRouter.namespaces.xr,
      serviceName,
      [blockNumber],
      query
    );
  }

  async getBlock(wallet: string, blockHash: string, query = this.queryNum): Promise<string> {
    const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrGetBlock);
    return await this.callService(
      XRouter.namespaces.xr,
      serviceName,
      [blockHash],
      query
    );
  }

  async getBlocks(wallet: string, blockHashes: string[], query = this.queryNum): Promise<string> {
    const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrGetBlocks);
    return await this.callService(
      XRouter.namespaces.xr,
      serviceName,
      [...blockHashes],
      query
    );
  }

  async getTransaction(wallet: string, txid: string, query = this.queryNum): Promise<string> {
    const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrGetTransaction);
    return await this.callService(
      XRouter.namespaces.xr,
      serviceName,
      [txid],
      query
    );
  }

  async getTransactions(wallet: string, txids: string[], query = this.queryNum): Promise<string> {
    const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrGetTransactions);
    return await this.callService(
      XRouter.namespaces.xr,
      serviceName,
      [...txids],
      query
    );
  }

  async sendTransaction(wallet: string, signedTx: string, query = 1): Promise<string> {
    const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrSendTransaction);
    return await this.callService(
      XRouter.namespaces.xr,
      serviceName,
      [signedTx],
      query
    );
  }

  async decodeTransaction(wallet: string, signedTx: string, query = this.queryNum): Promise<string> {
    const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrDecodeRawTransaction);
    return await this.callService(
      XRouter.namespaces.xr,
      serviceName,
      [signedTx],
      query
    );
  }

  async callService(namespace: string, serviceName: string, params: any[], query: number): Promise<string> {

    this._logInfo(`call service ${serviceName}`);
    const snodes = this.getSnodesByXrService(serviceName);
    this._logInfo(`${snodes.length} snodes serving ${serviceName}`);
    const filteredSnodes: ServiceNode[] = shuffle(snodes)
      .filter(snode => {
        return snode.isReady();
      });
    this._logInfo(`${filteredSnodes.length} snodes ready for ${serviceName}`);
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
        this._logInfo(`POST to ${path} with params ${jsonPayload}`);
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
            // ToDo check response signatures
            const xrPubKey = res.headers['xr-pubkey'];
            const xrSignature = res.headers['xr-signature'];
            const verified = xrPubKey === snode.pubKey && verifySignature(text, xrSignature, xrPubKey);
            if(!verified) {
              snode.downgradeStatus();
              throw new Error(`Response signature from ${path} could not be verified.`);
            }
            try {
              this._logInfo(`${serviceName} response from ${snode.host} ${text}`);
            } catch(err) {
              // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
              this._logErr(err.message + '\n' + err.stack);
            }
            resolve({
              pubKey: xrPubKey,
              hash: sha256(text),
              reply: text,
            });
          })
          .catch(err => {
            snode.lastRequestTime = Date.now();
            if(/Timeout/.test(err.message)) {
              snode.downgradeStatus();
            } else {
              // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
              this._logErr(err.message + '\n' + err.stack);
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
    return mostCommonReply(responseArr);
  }

}
