/* global require, before, describe, it */

require('should');
const { XRouter } = require('../dist');

describe('XRouter', function() {

  it('should be a constructor', function() {
    XRouter.should.be.Function();
    const instance = new XRouter();
    instance.should.be.an.instanceOf(XRouter);
  });

  describe('static xrNS method', function() {
    it('should add the xr deliminator to the end of a namespace', function() {
      const namespace = 'something';
      XRouter.xrNS(namespace).should.equal(namespace + XRouter.namespaces.xrdelim);
    });
  });

  describe('static isNS method', function() {
    it('should determine if a service string has an xrouter namespace', function() {
      const namespace = XRouter.namespaces.xr;
      const notNamespacedService = XRouter.spvCalls.xrGetBlockCount;
      XRouter.isNS(notNamespacedService, namespace).should.be.False();
      const namespacedService = namespace + XRouter.namespaces.xrdelim + notNamespacedService;
      XRouter.isNS(namespacedService, namespace).should.be.True();
    });
  });

  describe('static addNamespace method', function() {
    it('should add a namespace to a service', function() {
      const namespace = XRouter.namespaces.xr;
      const call = XRouter.spvCalls.xrGetBlockCount;
      const namespacedService = XRouter.addNamespace(call, namespace);
      namespacedService.should.equal(namespace + XRouter.namespaces.xrdelim + call);
      // if service is already namespaced, just returns the namespaced service as is
      XRouter.addNamespace(namespacedService, namespace).should.equal(namespacedService);
    });
  });

  describe('static removeNamespace method', function() {
    it('should remove a namespace from a service', function() {
      const call = XRouter.spvCalls.xrGetBlockCount;
      const xrNamespacedService = XRouter.namespaces.xr + XRouter.namespaces.xrdelim + call;
      XRouter.removeNamespace(xrNamespacedService).should.equal(call);
      const xrsNamespacedService = XRouter.namespaces.xrs + XRouter.namespaces.xrdelim + call;
      XRouter.removeNamespace(xrsNamespacedService).should.equal(call);
    });
  });

  describe('XRouter instance', function() {

    const wallet = 'BLOCK';
    const queryNum = 3;
    let xr;

    before(function() {
      xr = new XRouter({
        queryNum,
      });
      xr.on(XRouter.events.INFO, console.log);
    });

    describe('logInfo method', function() {
      it('should emit an info event', async function() {
        const message = 'something';
        const res = await new Promise(resolve => {
          xr.on(XRouter.events.INFO, str => {
            resolve(str);
          });
          xr.logInfo(message);
        });
        res.should.equal(message);
      });
    });

    describe('logErr method', function() {
      it('should emit an error event', async function() {
        const message = 'some error';
        const res = await new Promise(resolve => {
          xr.on(XRouter.events.ERROR, str => {
            resolve(str);
          });
          xr.logErr(message);
        });
        res.should.equal(message);
      });
    });

    describe('exrNodeCount method', function() {
      it('should return the number of exr nodes currently in the pool', function() {
        const count = xr.exrNodeCount();
        count.should.be.a.Number();
      });
    });

    describe('combineWithDelim method', function() {
      it('should combine two strings with the xr deliminator between them', function() {
        const str1 = 'some';
        const str2 = 'thing';
        const combined = xr.combineWithDelim(str1, str2);
        combined.should.equal(str1 + XRouter.namespaces.xrdelim + str2);
      });
    });

    describe('start method', function() {

      this.timeout(180000);

      it('should start xrouter', async function() {
        xr.start.should.be.a.Function();
        const ready = await xr.start();
        ready.should.be.a.Boolean();
        xr.exrNodeCount().should.be.greaterThanOrEqual(queryNum);
      });
    });

    describe('getSnodesByXrService method', function() {
      it('should get all snodes offering a service', function() {
        const service = wallet + XRouter.namespaces.xrdelim + XRouter.spvCalls.xrGetBlockCount;
        const snodes = xr.getSnodesByXrService(XRouter.namespaces.xr, service);
        snodes.should.be.an.Array();
        snodes.length.should.be.greaterThan(0);
      });
    });

    describe('RPC methods', function() {

      const blockCount = 2219929;
      const blockHashes = [
        '7ab6de76c90369b8d5e3ac09507df0ef58cc66b089dc77decdaef8d7121f0dee',
        '10bfa7bc698652bb973978b677737f894ed9fe5b3bff142bc7d7da6ec7577361',
      ];
      const transactions = [
        '638b8eee8975abd1eec0a19fc6114613dd5fcca8c36709f7813b65d9d4112b5f',
        '34730994fec6843d542d128596d2c9ed4522d44b0edb3723e05811d8a2d7a6cb',
      ];

      this.timeout(60000);

      before(async function() {
        await new Promise(resolve => setTimeout(resolve, 45000));
      });

      beforeEach(async function() {
        await new Promise(resolve => setTimeout(resolve, 45000));
      });

      describe('getBlockCountRaw', function() {
        it('should get the block count and return all responses', async function() {
          const res = await xr.getBlockCountRaw(wallet);
          res.should.be.an.Array();
          res.length.should.equal(queryNum);
        });
      });

      describe('getBlockCount', function() {
        it('should get the block count', async function() {
          const res = await xr.getBlockCount(wallet);
          res.should.be.a.String();
          const count = JSON.parse(res);
          count.should.be.a.Number();
        });
      });

      describe('getBlockHashRaw', function() {
        it('should get a block hash and return all responses', async function() {
          const res = await xr.getBlockHashRaw(wallet, blockCount);
          res.should.be.an.Array();
          res.length.should.equal(queryNum);
        });
      });

      describe('getBlockHash', function() {
        it('should get a block hash', async function() {
          const res = await xr.getBlockHash(wallet, blockCount);
          res.should.be.a.String();
          res.should.equal(blockHashes[0]);
        });
      });

      describe('getBlockRaw', function() {
        it('should get a block and return all responses', async function() {
          const res = await xr.getBlockRaw(wallet, blockHashes[0]);
          res.should.be.an.Array();
          res.length.should.equal(queryNum);
        });
      });

      describe('getBlock', function() {
        it('should get a block', async function() {
          const blockHash = blockHashes[0];
          const nextBlockHash = blockHashes[1];
          const res = await xr.getBlock(wallet, blockHash);
          res.should.be.a.String();
          const parsed = JSON.parse(res);
          parsed.should.be.an.Object();
          parsed.hash.should.equal(blockHash);
          parsed.nextblockhash.should.equal(nextBlockHash);
        });
      });

      describe('getBlocksRaw', function() {
        it('should get blocks and return all responses', async function() {
          const res = await xr.getBlocksRaw(wallet, blockHashes);
          res.should.be.an.Array();
          res.length.should.equal(queryNum);
        });
      });

      describe('getBlocks', function() {
        it('should get blocks', async function() {
          const res = await xr.getBlocks(wallet, blockHashes);
          res.should.be.a.String();
          const parsed = JSON.parse(res);
          parsed.should.be.an.Array();
          parsed.length.should.equal(blockHashes.length);
          parsed.forEach(block => block.should.be.an.Object());
          parsed[0].hash.should.equal(blockHashes[0]);
          parsed[1].hash.should.equal(blockHashes[1]);
        });
      });

      describe('getTransactionRaw', function() {
        it('should get a transaction and return all responses', async function() {
          const res = await xr.getTransactionRaw(wallet, transactions[0]);
          res.should.be.an.Array();
          res.length.should.equal(queryNum);
        });
      });

      describe('getTransaction', function() {
        it('should get a transaction', async function() {
          const transaction = transactions[0];
          const res = await xr.getTransaction(wallet, transaction);
          res.should.be.a.String();
          const parsed = JSON.parse(res);
          parsed.should.be.an.Object();
          parsed.txid.should.equal(transaction);
        });
      });

      describe('getTransactionsRaw', function() {
        it('should get transactions and return all responses', async function() {
          const res = await xr.getTransactionsRaw(wallet, transactions);
          res.should.be.an.Array();
          res.length.should.equal(queryNum);
        });
      });

      describe('getTransactions', function() {
        it('should get transactions', async function() {
          const res = await xr.getTransactions(wallet, transactions);
          res.should.be.a.String();
          const parsed = JSON.parse(res);
          parsed.should.be.an.Array();
          parsed.length.should.equal(transactions.length);
          parsed.forEach(tx => tx.should.be.an.Object());
          parsed[0].txid.should.equal(transactions[0]);
          parsed[1].txid.should.equal(transactions[1]);
        });
      });

    });

    describe('stop method', function() {
      it('should stop xrouter', function() {
        xr.stop();
        xr.started.should.be.False();
        xr.ready.should.be.False();
        xr.snodes.length.should.equal(0);
      });
    });

  });

});
