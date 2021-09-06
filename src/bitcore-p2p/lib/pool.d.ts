declare class Pool {
  connect(): void;
  inspect(): string;
  numberConnected(): number;
  on(event: string, callback: (peer: Peer, message: Message|undefined) => void): void;
}
