declare module 'p2p-manager' {
  class PeerManager {
    constructor(options: { magic: number, port: number, minPeers: number, maxPeers: number });
    addPool(hosts: string[]): void;
    on(event: string, callback: (res: any)=>void);
    status(): void;
    send(number: number, property: string, values: any, cmd: string, payload: any, answer: string, callback: (res: any)=>void): void;
    activePeers(): Peer[];
    connect(): void;
    numberConnected(): number;
    inspect(): string;
  }
}

declare module 'p2p-node' {
  class Peer {
    getUUID(): string;
    host: string;
    port: number;
    xrHost: string;
    xrPort: number;
    state: string;
    config: any;
    splitXrouterConfig: string[][];
    tls: boolean;
  }
}

// class Pool{
//   on(): void;
// }

// declare module '../bitcoin-p2p' {
//   class Pool {
//     on(): void;
//   }
// }
