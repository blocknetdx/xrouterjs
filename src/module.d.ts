declare module 'p2p-manager' {
  class PeerManager {
    constructor(options: { magic: number, port: number, minPeers: number, maxPeers: number });
    addPool(hosts: string[]): void;
    on(event: string, callback: (res: any)=>void);
    status(): void;
    send(number: number, property: string, values: any, cmd: string, payload: any, answer: string, callback: (res: any)=>void): void;
    activePeers: Peer[];
  }
}

declare module 'p2p-node' {
  class Peer {
    getUUID(): string;
    host: {host: string, port: number};
    state: string;
  }
}
