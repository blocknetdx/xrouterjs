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
      const blockHash = '7ab6de76c90369b8d5e3ac09507df0ef58cc66b089dc77decdaef8d7121f0dee';

      this.timeout(60000);

      before(async function() {
        await new Promise(resolve => setTimeout(resolve, 30000));
      });

      beforeEach(async function() {
        await new Promise(resolve => setTimeout(resolve, 30000));
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
        it('should get the block hash and return all responses', async function() {
          const res = await xr.getBlockHashRaw(wallet, blockCount);
          res.should.be.an.Array();
          res.length.should.equal(queryNum);
        });
      });

      describe('getBlockHash', function() {
        it('should get the block hash', async function() {
          const res = await xr.getBlockHash(wallet, blockCount);
          res.should.be.a.String();
          res.should.equal(blockHash);
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
