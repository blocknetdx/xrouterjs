const { XRouter } = require('./dist/types/xrouter');
const { blockMainnet } = require('./dist/networks/block');

(async function() {
  try {
    const client = new XRouter({
      network: blockMainnet,
    }, console.log, console.error);
    const started = await client.start();
    if(!started)
      return;
    const blockCount = await client.getBlockCount('BLOCK');
    console.log(`block count is ${blockCount}`);
  } catch(err) {
    console.error(err);
  }
})();
