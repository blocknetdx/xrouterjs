const RPCInterface = require('./libs/rpcInterface').default;
const express = require('express');
const { rpcPort, rpcUser, rpcPWD } = require('./config/config');

const rpcInterface = new RPCInterface(`http://127.0.0.1:${rpcPort}`, rpcUser, rpcPWD);

const app = express();
const port = 3000;
app.get('/', (req, res) => {
  res.send('xRouterJS Server!');
});

app.get('/getNetworkServices', async (req, res) => {
  const info = await rpcInterface.getNetworkServices();
  console.log(info);
  res.send(info);
});

app.get('/test', async (req, res) => {
    try {
        const info = await rpcInterface.connect("xr::BTC");
        console.log("info", info)
        const result = await rpcInterface.getBlockCount("xr::BTC");
        console.log("result", result);
        res.send(result);
    } catch(err) {
        console.log(err)
    }
  });

app.listen(port, err => {
  if (err) {
    return console.error(err);
  }
  return console.log(`server is listening on ${port}`);
});