import { Service } from './service';

export interface ServiceNodeData {
  pubKey: string;
  host: string;
  port: number;
  tls: boolean;
  exrCompatible: boolean;
  services: Array<Service>;
  wallets: Array<string>;
  plugins: Array<string>;
  xrouterVersion: number;
  fee: string;
  paymentAddress: string;
  clientRequestLimit: number;
  fetchLimit: number,
  lastPingTime: number,
  lastRequestTime?: number;
  statusWarningTimeoutLength?: number;
}

export class ServiceNode {

  static status = {
    GOOD: 'GOOD',
    WARNING: 'WARNING',
    BAD: 'BAD',
  };

  pubKey = '';
  host = '';
  port = 0;
  tls = false;
  exrCompatible = false;
  services: Array<Service> = [];
  plugins: Array<string> = [];
  wallets: Array<string> = [];
  xrouterVersion = 0;
  fee = '0';
  clientRequestLimit = 0;
  fetchLimit = 0;
  paymentAddress = '';
  lastPingTime = 0;
  lastRequestTime = 0;
  status = ServiceNode.status.GOOD;
  statusWarningTimeoutLength = 86400000; // 24 hrs in milliseconds
  statusWarningTimeout?: ReturnType<typeof setTimeout>;

  constructor(config: ServiceNodeData, logInfo = console.log) {
    const keys = new Set(Object.keys(config));
    if(keys.has('pubKey')) this.pubKey = config.pubKey || this.pubKey;
    if(keys.has('host')) this.host = config.host || this.host;
    if(keys.has('port')) this.port = config.port || this.port;
    if(keys.has('tls')) this.tls = config.tls || this.tls;
    if(keys.has('exrCompatible')) this.exrCompatible = config.exrCompatible || this.exrCompatible;
    if(keys.has('services')) this.services = config.services || this.services;
    if(keys.has('xrouterVersion')) this.xrouterVersion = config.xrouterVersion || this.xrouterVersion;
    if(keys.has('wallets')) this.wallets = config.wallets || this.wallets;
    if(keys.has('plugins')) this.plugins = config.plugins || this.plugins;
    if(keys.has('paymentAddress')) this.paymentAddress = config.paymentAddress || this.paymentAddress;
    if(keys.has('clientRequestLimit')) this.clientRequestLimit = config.clientRequestLimit || this.clientRequestLimit;
    if(keys.has('fetchLimit')) this.fetchLimit = config.fetchLimit || this.fetchLimit;
    if(keys.has('fee')) this.fee = config.fee || this.fee;
    if(keys.has('lastPingTime')) this.lastPingTime = config.lastPingTime || this.lastPingTime;
    if(keys.has('lastRequestTime')) this.lastRequestTime = config.lastRequestTime || this.lastRequestTime;
    if(keys.has('statusWarningTimeoutLength')) this.statusWarningTimeoutLength = config.statusWarningTimeoutLength || this.statusWarningTimeoutLength;
    if(logInfo) this._logInfo = logInfo;
  }

  _logInfo(message: string): void {
    console.log(message);
  }

  endpoint(): string {
    const host = this.host;
    const tls = this.tls;
    const port = tls ? 443 : this.port;
    return `${tls ? 'https' : 'http'}://${host}${port ? `:${port}` : ''}`;
  }

  private serviceIndexes: {[name: string]: number} = {};

  addService(service: Service): void {
    const newLength = this.services.push(service);
    this.serviceIndexes[service.name] = newLength - 1;
  }

  hasService(name: string, maxFee = 0): boolean {
    const idx = this.serviceIndexes[name];
    return this.exrCompatible
      && idx >= 0
      && Number(this.services[idx].fee) <= maxFee;
  }

  getService(name: string): Service {
    const idx = this.serviceIndexes[name];
    return this.services[idx];
  }

  timeToReady(): number {
    const { clientRequestLimit, lastRequestTime } = this;
    const now = Date.now();
    if(clientRequestLimit && lastRequestTime) {
      const diff = lastRequestTime + clientRequestLimit - now;
      return diff > 0 ? diff : 0;
    } else {
      return 0;
    }
  }

  isReady(): boolean {
    return this.timeToReady() === 0 && this.status !== ServiceNode.status.BAD;
  }

  setStatus(status: string): void {
    this._logInfo(`${this.host} status set to ${status}`);
    if(this.statusWarningTimeout)
      clearTimeout(this.statusWarningTimeout);
    this.status = status;
  }

  downgradeStatus(): void {
    const { status } = this;
    if(this.statusWarningTimeout)
      clearTimeout(this.statusWarningTimeout);
    if(status === ServiceNode.status.GOOD) {
      this.status = ServiceNode.status.WARNING;
      this.statusWarningTimeout = setTimeout(() => {
        this.status = ServiceNode.status.GOOD;
      }, this.statusWarningTimeoutLength);
    } else if(status === ServiceNode.status.WARNING) {
      this.status = ServiceNode.status.BAD;
    }
    this._logInfo(`${this.host} status downgraded to ${this.status}`);
  }

}
