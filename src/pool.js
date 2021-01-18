const { Pool } = require('./bitcore-p2p');

const pool = new Pool();

// connect to the network
pool.connect();
// attach peer events
pool.on('peerinv', (peer, message) => {
  // a new peer message has arrived
  console.log(peer.port);
});

// eslint-disable-next-line no-empty
// while (true) {

// }
