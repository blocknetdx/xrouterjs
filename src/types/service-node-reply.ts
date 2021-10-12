export class SnodeReply {

  pubKey: string;
  hash: string;
  reply: string;

  constructor(pubKey: string, hash: string, reply: string) {
    this.pubKey = pubKey;
    this.hash = hash;
    this.reply = reply;
  }

}
