const { XRouter } = require('./dist/types/xrouter');
const { blockMainnet } = require('./dist/networks/block');

const timeout = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

(async function() {
  try {

    // create xrouter client
    const client = new XRouter({
      network: blockMainnet,
    }, console.log, console.error);

    // start the server & wait for it to find two or more EXR nodes
    const started = await client.start();
    if(!started)
      return;

    const wallet = 'BLOCK';
    const queryNum = 2;

    // make an spv call
    const blockCount = await new Promise(resolve => {
      const interval = setInterval(() => {
        client.getBlockCount(wallet, queryNum)
          .then(res => {
            clearInterval(interval);
            resolve(res);
          })
          .catch(() => {
            // do nothing
          });
      }, 30000);
    });
    console.log(`block count is ${blockCount}`);

    await timeout(30000);

    const blockHash = await client.getBlockHash(wallet, blockCount, queryNum);
    console.log(`block hash is ${blockHash}`);

    await timeout(30000);

    const blockData = await client.getBlock(wallet, blockHash, queryNum);
    console.log('block data', blockData);

    const blocksData = await client.getBlocks(wallet, [blockData.hash, blockData.previousblockhash], queryNum);
    console.log('blocks data', blocksData);

  } catch(err) {
    console.error(err);
  }
})();
