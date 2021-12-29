"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.XRouter = void 0;
const lib_1 = require("../bitcore-p2p/lib");
const service_node_1 = require("./service-node");
const service_1 = require("./service");
const superagent_1 = __importDefault(require("superagent"));
const isNull_1 = __importDefault(require("lodash/isNull"));
const isObject_1 = __importDefault(require("lodash/isObject"));
const shuffle_1 = __importDefault(require("lodash/shuffle"));
const util_1 = require("../util");
const uniq_1 = __importDefault(require("lodash/uniq"));
const service_node_reply_1 = require("./service-node-reply");
const events_1 = require("events");
const networks_1 = require("../networks");
const mostCommonReply = (replies) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const filtered = replies
        .filter(r => !(0, isNull_1.default)(r));
    const counts = new Map();
    const values = new Map();
    for (const { hash, reply } of filtered) {
        const count = counts.get(hash) || 0;
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
class XRouter extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.started = false;
        this.ready = false;
        this.snodes = [];
        this._timeout = 30000;
        const { network = XRouter.networks.MAINNET, maxPeers = 8, maxFee = 0, queryNum = 5, timeout = 10000, } = options;
        this.maxPeers = maxPeers;
        this.maxFee = maxFee;
        this.queryNum = queryNum;
        this.timeout = timeout;
        this.network = network;
        const peerMgr = new lib_1.Pool({
            network: network.name,
            maxSize: maxPeers,
        });
        peerMgr.on('peerconnect', (peer) => {
            this.logInfo(`Connected to ${peer.host}`);
        });
        peerMgr.on('peerdisconnect', (peer) => {
            this.logInfo(`Disconnected from ${peer.host}`);
            this.started = peerMgr.numberConnected() > 0;
        });
        peerMgr.on('peersnp', (peer, message) => {
            if (message.config && message.config.xrouter && message.config.xrouter.config) {
                const { pubKey: pubKeyRaw, pingTime } = message;
                const pubKey = pubKeyRaw.toString('hex');
                if (this.snodes.some(snode => snode.pubKey === pubKey && snode.lastPingTime === pingTime))
                    return;
                const splitConfig = message.config.xrouter.config
                    .split('\n')
                    .map((s) => s.trim())
                    .filter((s) => s)
                    .filter((s) => !/^#/.test(s))
                    .map((s) => s.split('=').map(ss => ss.trim()));
                const sections = (0, util_1.splitIntoSections)(splitConfig);
                const mainIdx = sections.findIndex((arr) => arr[0] === 'Main');
                if (mainIdx < 0)
                    return;
                const mainSection = sections[mainIdx];
                const serviceSections = sections.filter((a, i) => i !== mainIdx);
                const xrouterVersion = message.config.xrouterversion;
                const { 
                // main specific
                host, port: portStr = '0', wallets, paymentaddress: paymentAddress, plugins = '', 
                // shared with services
                clientrequestlimit: clientRequestLimit = '0', fee, fetchlimit: fetchLimit = '0', tls = '0', } = mainSection[1];
                if (!host)
                    return;
                const port = Number(portStr) || this.network.port;
                const serviceNodeData = {
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
                    rawConfig: message.config.xrouter.config,
                };
                const idx = this.snodes.findIndex(n => n.pubKey === pubKey);
                let sn;
                if (idx > 0) {
                    sn = this.snodes[idx];
                    for (const key of Object.keys(serviceNodeData)) {
                        // @ts-ignore
                        sn[key] = serviceNodeData[key];
                    }
                }
                else {
                    sn = new service_node_1.ServiceNode(serviceNodeData);
                    sn.on('INFO', this.logInfo.bind(this));
                }
                const serviceInstances = serviceSections
                    .map(([name, options]) => new service_1.Service({
                    name,
                    clientRequestLimit: options.clientrequestlimit ? Number(options.clientrequestlimit) : serviceNodeData.clientRequestLimit,
                    fetchLimit: options.fetchlimit ? Number(options.fetchLimit) : serviceNodeData.fetchLimit,
                    disabled: options.disabled && options.disabled === '0' ? true : false,
                    fee: options.fee || sn.fee,
                    help: options.help,
                }))
                    .reduce((obj, svc) => {
                    obj[svc.name] = svc;
                    return obj;
                }, {});
                for (const wallet of sn.wallets) {
                    for (const method of Object.keys(XRouter.spvCalls)) {
                        const combined = `${wallet.toUpperCase()}::${method}`;
                        if (!serviceInstances[combined]) { // if the service isn't already in the list
                            if (serviceInstances[method]) { // if the method is already in the list
                                serviceInstances[combined] = new service_1.Service(Object.assign(Object.assign({}, serviceInstances[method]), { name: combined }));
                            }
                            else {
                                serviceInstances[combined] = new service_1.Service({
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
                for (const plugin of sn.plugins) {
                    const combined = `xrs::${plugin}`;
                    if (!serviceInstances[combined]) { // if the service isn't already in the list
                        serviceInstances[combined] = new service_1.Service({
                            name: combined,
                            clientRequestLimit: sn.clientRequestLimit,
                            fetchLimit: sn.fetchLimit,
                            fee: sn.fee,
                            help: '',
                            disabled: false,
                        });
                    }
                }
                for (const svc of Object.values(serviceInstances)) {
                    if (!svc.disabled)
                        sn.addService(svc);
                }
                if (idx >= 0) {
                    this.snodes[idx] = sn;
                }
                else {
                    this.snodes.push(sn);
                }
            }
            this.started = true;
        });
        this.peerMgr = peerMgr;
    }
    static xrNS(ns) {
        return ns + XRouter.namespaces.xrdelim;
    }
    static isNS(service, ns) {
        const patt = new RegExp('^' + XRouter.xrNS(ns));
        return patt.test(service);
    }
    static addNamespace(service, ns) {
        if (!XRouter.isNS(service, ns)) {
            return XRouter.xrNS(ns) + service;
        }
        return service;
    }
    static removeNamespace(service) {
        const { xr, xrs } = XRouter.namespaces;
        if (XRouter.isNS(service, xr)) {
            return service.replace(new RegExp(`^${XRouter.xrNS(xr)}`), '');
        }
        else if (XRouter.isNS(service, xrs)) {
            return service.replace(new RegExp(`^${XRouter.xrNS(xrs)}`), '');
        }
        return service;
    }
    logInfo(message) {
        this.emit(XRouter.events.INFO, message);
    }
    logErr(message) {
        this.emit(XRouter.events.ERROR, message);
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.started) {
                this.logInfo('Starting XRouter client');
                this._inspectInterval = setInterval(() => {
                    this.logInfo(JSON.stringify(this.status()));
                    // this.logInfo(this.peerMgr.inspect());
                }, 60000);
                this.peerMgr.connect();
                yield new Promise((resolve) => {
                    const interval = setInterval(() => {
                        if (this.started) {
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
            if (this.started) {
                this.logInfo('XRouter started');
                yield new Promise(resolve => {
                    const nodeCountInterval = setInterval(() => {
                        if (this.exrNodeCount() >= this.queryNum) {
                            clearInterval(nodeCountInterval);
                            resolve();
                        }
                    }, 1000);
                });
                this.ready = true;
                this.logInfo('XRouter is ready');
            }
            return this.ready;
        });
    }
    stop() {
        this.logInfo('Stopping XRouter');
        this.started = false;
        this.ready = false;
        this.snodes.forEach(s => s.close());
        this.snodes = [];
        // @ts-ignore
        this.peerMgr.disconnect();
        clearInterval(this._inspectInterval);
    }
    isStarted() {
        return this.started;
    }
    isReady() {
        return this.ready;
    }
    status() {
        const { peerMgr } = this;
        return {
            connectedPeers: peerMgr.numberConnected(),
            totalPeers: peerMgr._addrs.length,
            exrNodes: this.exrNodeCount(),
            totalXRNodes: this.snodes.length,
        };
    }
    exrNodeCount() {
        return this.snodes.filter(sn => sn.exrCompatible).length;
    }
    combineWithDelim(str1, str2) {
        return str1 + XRouter.namespaces.xrdelim + str2;
    }
    getSnodesByXrService(namespace, serviceName) {
        return this.snodes
            .filter(sn => sn.hasService(namespace, serviceName, this.maxFee));
    }
    getAllAvailableSPVServices() {
        const servicesArr = [];
        for (const sn of this.snodes) {
            for (const [wallet, services] of sn.getServicesByWallets()) {
                const idx = servicesArr.findIndex(([w]) => w === wallet);
                if (idx >= 0)
                    servicesArr[idx][1] = (0, uniq_1.default)([...servicesArr[idx][1], ...services]);
                else
                    servicesArr.push([wallet, [...services]]);
            }
        }
        return servicesArr
            .map(([wallet, services]) => {
            return [
                wallet,
                services.map(s => ({ name: s, parameters: this.getParamsForXrService(s) })),
            ];
        });
    }
    getParamsForXrService(service) {
        const params = [
            ['wallet', 'string'],
        ];
        switch (service) {
            case 'xrGetBlockCount':
                break;
            case 'xrGetBlockHash':
                params.push(['blockNumber', 'number']);
                break;
            case 'xrGetBlock':
                params.push(['blockHash', 'string']);
                break;
            case 'xrGetBlocks':
                params.push(['blockHashes', 'string']);
                break;
            case 'xrGetTransaction':
                params.push(['txid', 'string']);
                break;
            case 'xrGetTransactions':
                params.push(['txids', 'string']);
                break;
            case 'xrSendTransaction':
                params.push(['signedTx', 'string']);
                break;
            case 'xrDecodeRawTransaction':
                params.push(['signedTx', 'string']);
                break;
        }
        return params;
    }
    getBlockCountRaw(wallet, query = this.queryNum) {
        return __awaiter(this, void 0, void 0, function* () {
            const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrGetBlockCount);
            return yield this._callService(XRouter.namespaces.xr, serviceName, [], query);
        });
    }
    getBlockCount(wallet, query = this.queryNum) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.getBlockCountRaw(wallet, query);
            return mostCommonReply(res);
        });
    }
    getBlockHashRaw(wallet, blockNumber, query = this.queryNum) {
        return __awaiter(this, void 0, void 0, function* () {
            const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrGetBlockHash);
            return yield this._callService(XRouter.namespaces.xr, serviceName, [blockNumber], query);
        });
    }
    getBlockHash(wallet, blockNumber, query = this.queryNum) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.getBlockHashRaw(wallet, blockNumber, query);
            return mostCommonReply(res);
        });
    }
    getBlockRaw(wallet, blockHash, query = this.queryNum) {
        return __awaiter(this, void 0, void 0, function* () {
            const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrGetBlock);
            return yield this._callService(XRouter.namespaces.xr, serviceName, [blockHash], query);
        });
    }
    getBlock(wallet, blockHash, query = this.queryNum) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.getBlockRaw(wallet, blockHash, query);
            return mostCommonReply(res);
        });
    }
    getBlocksRaw(wallet, blockHashes, query = this.queryNum) {
        return __awaiter(this, void 0, void 0, function* () {
            const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrGetBlocks);
            return yield this._callService(XRouter.namespaces.xr, serviceName, [...blockHashes], query);
        });
    }
    getBlocks(wallet, blockHashes, query = this.queryNum) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.getBlocksRaw(wallet, blockHashes, query);
            return mostCommonReply(res);
        });
    }
    getTransactionRaw(wallet, txid, query = this.queryNum) {
        return __awaiter(this, void 0, void 0, function* () {
            const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrGetTransaction);
            return yield this._callService(XRouter.namespaces.xr, serviceName, [txid], query);
        });
    }
    getTransaction(wallet, txid, query = this.queryNum) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.getTransactionRaw(wallet, txid, query);
            return mostCommonReply(res);
        });
    }
    getTransactionsRaw(wallet, txids, query = this.queryNum) {
        return __awaiter(this, void 0, void 0, function* () {
            const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrGetTransactions);
            return yield this._callService(XRouter.namespaces.xr, serviceName, [...txids], query);
        });
    }
    getTransactions(wallet, txids, query = this.queryNum) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.getTransactionsRaw(wallet, txids, query);
            return mostCommonReply(res);
        });
    }
    sendTransactionRaw(wallet, signedTx, query = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrSendTransaction);
            return yield this._callService(XRouter.namespaces.xr, serviceName, [signedTx], query);
        });
    }
    sendTransaction(wallet, signedTx, query = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.sendTransactionRaw(wallet, signedTx, query);
            return mostCommonReply(res);
        });
    }
    decodeTransactionRaw(wallet, signedTx, query = this.queryNum) {
        return __awaiter(this, void 0, void 0, function* () {
            const serviceName = this.combineWithDelim(wallet, XRouter.spvCalls.xrDecodeRawTransaction);
            return yield this._callService(XRouter.namespaces.xr, serviceName, [signedTx], query);
        });
    }
    decodeTransaction(wallet, signedTx, query = this.queryNum) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.decodeTransactionRaw(wallet, signedTx, query);
            return mostCommonReply(res);
        });
    }
    decodeRawTransaction(wallet, signedTx, query = this.queryNum) {
        return this.decodeTransaction(wallet, signedTx, query);
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    callXrServiceRaw(service, params, query = this.queryNum) {
        return __awaiter(this, void 0, void 0, function* () {
            const serviceName = this.combineWithDelim(params[0], service);
            return yield this._callService(XRouter.namespaces.xr, serviceName, params.slice(1), query);
        });
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    callXrService(service, params, query) {
        return __awaiter(this, void 0, void 0, function* () {
            if (params.length === 0)
                throw new Error('Missing wallet param e.g. "BLOCK"');
            const res = yield this.callXrServiceRaw(service, params, query);
            return mostCommonReply(res);
        });
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    callServiceRaw(service, params, query = this.queryNum) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._callService(XRouter.namespaces.xrs, service, params, query);
        });
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    callService(service, params, query) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.callServiceRaw(service, params, query);
            return mostCommonReply(res);
        });
    }
    _callService(namespace, serviceName, params, query) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logInfo(`call service ${serviceName}`);
            const snodes = this.getSnodesByXrService(namespace, serviceName);
            this.logInfo(`${snodes.length} snodes serving ${serviceName}`);
            const filteredSnodes = (0, shuffle_1.default)(snodes)
                .filter(snode => {
                return snode.isReady();
            });
            this.logInfo(`${filteredSnodes.length} snodes ready for ${serviceName}`);
            const responseArr = [];
            for (const snode of filteredSnodes) {
                const reply = yield new Promise(resolve => {
                    let path = '';
                    if (namespace === XRouter.namespaces.xr) {
                        const [wallet, xrFunc] = serviceName.split(XRouter.namespaces.xrdelim);
                        path = `${snode.endpoint()}/${namespace}/${wallet}/${xrFunc}`;
                    }
                    else if (namespace === XRouter.namespaces.xrs) {
                        path = `${snode.endpoint()}/${namespace}/${serviceName}`;
                    }
                    const jsonPayload = JSON.stringify(params);
                    this.logInfo(`POST to ${path} with params ${jsonPayload}`);
                    superagent_1.default
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
                            Object.assign(res, { text });
                            cb(null, res);
                        });
                    })
                        .timeout(this.timeout)
                        .then(res => {
                        snode.lastRequestTime = Date.now();
                        const { text = '' } = res;
                        const xrPubKey = res.headers['xr-pubkey'];
                        const xrSignature = res.headers['xr-signature'];
                        const verified = xrPubKey === snode.pubKey && (0, util_1.verifySignature)(text, xrSignature, xrPubKey);
                        if (!verified) {
                            snode.downgradeStatus();
                            throw new Error(`Response signature from ${path} could not be verified.`);
                        }
                        try {
                            this.logInfo(`${serviceName} response from ${snode.host} ${text}`);
                        }
                        catch (err) {
                            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                            // @ts-ignore
                            this.logErr(err.message + '\n' + err.stack);
                        }
                        resolve(new service_node_reply_1.SnodeReply(snode.pubKey, (0, util_1.sha256)(text), text));
                    })
                        .catch(err => {
                        snode.lastRequestTime = Date.now();
                        if (/Timeout/.test(err.message)) {
                            snode.downgradeStatus();
                        }
                        else {
                            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                            this.logErr(err.message + '\n' + err.stack);
                        }
                        resolve(null);
                    });
                });
                if ((0, isObject_1.default)(reply)) {
                    responseArr.push(reply);
                    if (responseArr.length === query)
                        break;
                }
            }
            if (responseArr.length < query)
                throw new Error(`Responses returned from only ${responseArr.length} out of the required ${query} nodes.`);
            return responseArr;
        });
    }
}
exports.XRouter = XRouter;
XRouter.networks = {
    MAINNET: networks_1.Networks.MAINNET,
};
XRouter.events = {
    INFO: 'INFO',
    ERROR: 'ERROR',
};
XRouter.namespaces = {
    xr: 'xr',
    xrs: 'xrs',
    xrd: 'xrd',
    xrdelim: '::',
};
XRouter.spvCalls = {
    xrGetBlockCount: 'xrGetBlockCount',
    xrGetBlockHash: 'xrGetBlockHash',
    xrGetBlock: 'xrGetBlock',
    xrGetBlocks: 'xrGetBlocks',
    xrGetTransaction: 'xrGetTransaction',
    xrGetTransactions: 'xrGetTransactions',
    xrDecodeRawTransaction: 'xrDecodeRawTransaction',
    xrSendTransaction: 'xrSendTransaction',
};
XRouter.otherCalls = {
    xrService: 'xrService',
};
//# sourceMappingURL=xrouter.js.map