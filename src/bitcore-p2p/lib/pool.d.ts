declare class Pool {
  connect(): void;
  inspect(): string;
  numberConnected(): number;
  _addrs: any[];
  on(event: string, callback: (peer: Peer, message: Message|undefined) => void): void;
}
