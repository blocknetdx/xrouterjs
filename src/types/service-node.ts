export interface ServiceNodeData {
  pubKey?: string|undefined;
  host?: string|undefined;
  port?: number|undefined;
  endpoint?: string|undefined;
  tls?: boolean|undefined;
  exrCompatible?: boolean|undefined;
  services?: Array<string>|undefined;
  wallets?: Array<string>|undefined;
  username?: string|undefined;
  password?: string|undefined;
  xrouterVersion?: number|undefined;
  configStr?: string|undefined;
}

export class ServiceNode {

  pubKey = '';
  host = '';
  port = 41414;
  tls = false;
  exrCompatible = false;
  services: Array<string> = [];
  wallets: Array<string> = [];
  xrouterVersion = 0;
  configStr = '';

  constructor(config: ServiceNodeData) {
    const keys = new Set(Object.keys(config));
    if(keys.has('pubKey')) this.pubKey = config.pubKey || this.pubKey;
    if(keys.has('host')) this.host = config.host || this.host;
    if(keys.has('port')) this.port = config.port || this.port;
    if(keys.has('tls')) this.tls = config.tls || this.tls;
    if(keys.has('exrCompatible')) this.exrCompatible = config.exrCompatible || this.exrCompatible;
    if(keys.has('services')) this.services = config.services || this.services;
    if(keys.has('xrouterVersion')) this.xrouterVersion = config.xrouterVersion || this.xrouterVersion;
    if(keys.has('configStr')) this.configStr = config.configStr || this.configStr;
    if(keys.has('wallets')) this.wallets = config.wallets || this.wallets;
  }

  endpoint(): string {
    const host = this.host;
    const port = this.port;
    const tls = this.tls;
    return `${tls ? 'https' : 'http'}://${host}${port ? `:${port}` : ''}`;
  }

}
