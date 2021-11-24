"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceNode = void 0;
const events_1 = require("events");
const xrouter_1 = require("./xrouter");
class ServiceNode extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.pubKey = '';
        this.host = '';
        this.port = 0;
        this.tls = false;
        this.exrCompatible = false;
        this.services = [];
        this.plugins = [];
        this.wallets = [];
        this.xrouterVersion = 0;
        this.fee = '0';
        this.clientRequestLimit = 0;
        this.fetchLimit = 0;
        this.paymentAddress = '';
        this.lastPingTime = 0;
        this.lastRequestTime = 0;
        this.status = ServiceNode.status.GOOD;
        this.statusWarningTimeoutLength = 86400000; // 24 hrs in milliseconds
        this.serviceIndexes = {};
        const keys = new Set(Object.keys(config));
        if (keys.has('pubKey'))
            this.pubKey = config.pubKey || this.pubKey;
        if (keys.has('host'))
            this.host = config.host || this.host;
        if (keys.has('port'))
            this.port = config.port || this.port;
        if (keys.has('tls'))
            this.tls = config.tls || this.tls;
        if (keys.has('exrCompatible'))
            this.exrCompatible = config.exrCompatible || this.exrCompatible;
        if (keys.has('services'))
            this.services = config.services || this.services;
        if (keys.has('xrouterVersion'))
            this.xrouterVersion = config.xrouterVersion || this.xrouterVersion;
        if (keys.has('wallets'))
            this.wallets = config.wallets || this.wallets;
        if (keys.has('plugins'))
            this.plugins = config.plugins || this.plugins;
        if (keys.has('paymentAddress'))
            this.paymentAddress = config.paymentAddress || this.paymentAddress;
        if (keys.has('clientRequestLimit'))
            this.clientRequestLimit = config.clientRequestLimit || this.clientRequestLimit;
        if (keys.has('fetchLimit'))
            this.fetchLimit = config.fetchLimit || this.fetchLimit;
        if (keys.has('fee'))
            this.fee = config.fee || this.fee;
        if (keys.has('lastPingTime'))
            this.lastPingTime = config.lastPingTime || this.lastPingTime;
        if (keys.has('lastRequestTime'))
            this.lastRequestTime = config.lastRequestTime || this.lastRequestTime;
        if (keys.has('statusWarningTimeoutLength'))
            this.statusWarningTimeoutLength = config.statusWarningTimeoutLength || this.statusWarningTimeoutLength;
        this.close = this.close.bind(this);
    }
    close() {
        if (this.statusWarningTimeout)
            clearTimeout(this.statusWarningTimeout);
    }
    _logInfo(message) {
        this.emit('INFO', message);
    }
    endpoint() {
        const host = this.host;
        const tls = this.tls;
        const port = tls ? 443 : this.port;
        return `${tls ? 'https' : 'http'}://${host}${port ? `:${port}` : ''}`;
    }
    addService(service) {
        const newLength = this.services.push(service);
        this.serviceIndexes[service.name] = newLength - 1;
    }
    hasService(namespace, name, maxFee = 0) {
        let idx;
        if (namespace === xrouter_1.XRouter.namespaces.xr) {
            idx = this.serviceIndexes[name];
        }
        else {
            idx = this.serviceIndexes[namespace + xrouter_1.XRouter.namespaces.xrdelim + name];
        }
        return this.exrCompatible
            && idx >= 0
            && Number(this.services[idx].fee) <= maxFee;
    }
    getService(name) {
        const idx = this.serviceIndexes[name];
        return this.services[idx];
    }
    timeToReady() {
        const { clientRequestLimit, lastRequestTime } = this;
        const now = Date.now();
        if (clientRequestLimit && lastRequestTime) {
            const diff = lastRequestTime + clientRequestLimit - now;
            return diff > 0 ? diff : 0;
        }
        else {
            return 0;
        }
    }
    isReady() {
        return this.timeToReady() === 0 && this.status !== ServiceNode.status.BAD;
    }
    setStatus(status) {
        this._logInfo(`${this.host} status set to ${status}`);
        if (this.statusWarningTimeout)
            clearTimeout(this.statusWarningTimeout);
        this.status = status;
    }
    downgradeStatus() {
        const { status } = this;
        if (this.statusWarningTimeout)
            clearTimeout(this.statusWarningTimeout);
        if (status === ServiceNode.status.GOOD) {
            this.status = ServiceNode.status.WARNING;
            this.statusWarningTimeout = setTimeout(() => {
                this.status = ServiceNode.status.GOOD;
            }, this.statusWarningTimeoutLength);
        }
        else if (status === ServiceNode.status.WARNING) {
            this.status = ServiceNode.status.BAD;
        }
        this._logInfo(`${this.host} status downgraded to ${this.status}`);
    }
}
exports.ServiceNode = ServiceNode;
ServiceNode.status = {
    GOOD: 'GOOD',
    WARNING: 'WARNING',
    BAD: 'BAD',
};
//# sourceMappingURL=service-node.js.map