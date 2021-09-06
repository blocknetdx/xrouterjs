const { XRouter } = require('./dist/types/xrouter');
const { blockMainnet } = require('./dist/networks/block');

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

    // make an spv call
    const blockCount = await client.getBlockCount('BLOCK');
    console.log(`block count is ${blockCount}`);

  } catch(err) {
    console.error(err);
  }
})();
