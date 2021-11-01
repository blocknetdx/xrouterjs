# Javascript library for xRouter

## Getting Started
1. Install [Node.js](https://nodejs.org/en/)
2. Clone repo: `git clone https://github.com/blocknetdx/xrouterjs.git`
3. Enter directory: `cd xrouterjs`
4. Install dependencies: `npm install`
5. Build library: `npm run build`
6. Run example.js: `node example.js`

## Constructing an XRouter instance
```js

interface XrouterOptions {
  network?: NetworkParams,
  maxPeers?: number;
  maxFee?: number;
  queryNum?: number;
  timeout?: number;
}

const xrClient = new XRouter(options: XrouterOptions);
```

## Listening for events
```js
xrClient.on(XRouter.events.INFO, message => {
  // do something with the info message string e.g. console.log(message);
});
xrClient.on(XRouter.events.ERROR, message => {
  // do something with the error message string e.g. console.error(message);
});
```

## Starting the XRouter server
```js
start(): Promise<boolean>;
// e.g. xrClient.start().then(ready => console.log(`Ready: ${ready}`)).catch(console.error);
```

## XRouter Instance SPV Methods
```js
getBlockCount(wallet: string, query: number): Promise<string>
// e.g. xrClient.getBlockCount('BLOCK', 3).then(console.log).catch(console.error);

getBlockHash(wallet: string, blockNumber: number, query: number): Promise<string>
// e.g. xrClient.getBlockCount('BLOCK', 2191103, 3).then(console.log).catch(console.error);

getBlock(wallet: string, blockHash: string, query: number): Promise<string>
// e.g. xrClient.getBlock('BLOCK', '1ffb53bcc380c508cab30e3cadda4ff0f43d66c2849dbbccea4292953f81493b', 3).then(console.log).catch(console.error);

getBlocks(wallet: string, blockHashes: string[], query: number): Promise<string>
// e.g. xrClient.getBlocks('BLOCK', ['1ffb53bcc380c508cab30e3cadda4ff0f43d66c2849dbbccea4292953f81493b', '89f0e3cdbc2a9b98b104f7dec88089b41eca1808314db813fe16120e121ed75c'], 3).then(console.log).catch(console.error);

getTransaction(wallet: string, txid: string, query: number): Promise<string>
// e.g. xrClient.getTransaction('BLOCK', 'c8230c8010706599a7ad68fe7aabdef551a889bbce445b90c00fd856a81ebac2', 3).then(console.log).catch(console.error);

getTransactions(wallet: string, txids: string[], query: number): Promise<string>
// e.g. xrClient.getTransactions('BLOCK', ['c8230c8010706599a7ad68fe7aabdef551a889bbce445b90c00fd856a81ebac2', '7d0b4082c179c93768b2d818280cc4c1385564c16fb72fc027af8e7d3f1be31f'], 3).then(console.log).catch(console.error);

sendTransaction(wallet: string, signedTx: string, query: number): Promise<string>
// e.g. xrClient.sendTransaction('BLOCK', signedTx, 1).then(console.log).catch(console.error);

decodeTransaction(wallet: string, signedTx: string, query: number): Promise<string>
// e.g. xrClient.decodeTransaction('BLOCK', signedTx, 3).then(console.log).catch(console.error);
```

## XRouter Instance `xrs` Methods
```js
callService(service: string, params: any, query: number): Promise<string>
// e.g. xrClient.callService('eth_passthrough', {jsonrpc: '2.0', method: 'eth_blocknumber', params: [], id: 1}, 3);
```

## Running tests
1. Build the library: `npm run build`
2. Run the tests: `npm run test`

## License

By downloading and using this software, you acknowledge that:
- This is an open source tool and you agree to use this tool in accordance with local laws.
- This software is in beta and can include bugs that may result in irretrievable loss of funds.
- This software is licensed under The MIT License and you agree to the terms of the license below.

[ X ] By using this software you acknowledge the financial and legal risks of using this software and agree to assume all responsibility. If you do not agree to these terms do not use the software.

The MIT License (MIT)

Copyright (c) 2021 The Blocknet Developers

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
