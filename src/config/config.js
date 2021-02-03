const dotenv = require('dotenv');
dotenv.config();
module.exports = {
    rpcPort: process.env.rpcPort,
    rpcUser: process.env.rpcUser,
    rpcPWD: process.env.rpcPWD
};