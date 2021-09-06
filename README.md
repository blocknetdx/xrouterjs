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

const xrClient = new XRouter(
  options: XrouterOptions,
  logInfo: (message: string)=>void, // defaults to console.log
  logError: (message: string)=>void // defaults to console.error
);
```

## XRouter Instance SPV Methods
```js
getBlockCount(wallet: string, query: number): Promise<number>;
// e.g. xrClient.getBlockCount('BLOCK', 3).then(console.log).catch(console.error);

getBlockHash(wallet: string, blockNumber: number, query: number): Promise<number>;
// e.g. xrClient.getBlockCount('BLOCK', 2139658, 3).then(console.log).catch(console.error);
````

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
