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
    const blockCountStr = await new Promise(resolve => {
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
    const blockCount = JSON.parse(blockCountStr);
    console.log(`block count is ${blockCount}`);

    await timeout(30000);

    const blockHash = await client.getBlockHash(wallet, blockCount, queryNum);
    console.log(`block hash is ${blockHash}`);

    await timeout(30000);

    const blockDataStr = await client.getBlock(wallet, blockHash, queryNum);
    const blockData = JSON.parse(blockDataStr);
    console.log('block data', blockData);

    const blocksDataStr = await client.getBlocks(wallet, [blockData.hash, blockData.previousblockhash], queryNum);
    const blocksData = JSON.parse(blocksDataStr);
    console.log('blocks data', blocksData);

    const txids = blocksData
      .reduce((arr, data) => arr.concat(data.tx), []);

    await timeout(30000);

    const [ txid ] = txids;
    const transactionStr = await client.getTransaction(wallet, txid, queryNum);
    const transaction = JSON.parse(transactionStr);
    console.log('transaction', transaction);

    await timeout(30000);

    const transactionsStr = await client.getTransactions(wallet, txids, queryNum);
    const transactions = JSON.parse(transactionsStr);
    console.log('transactions', transactions);

  } catch(err) {
    console.error(err);
  }
})();
