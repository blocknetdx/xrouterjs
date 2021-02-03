const axios = require('axios');

class RPCInterface
{
    constructor(url, rpcUser, rpcPWD)
    {
        this.url = url;
        this.authHeader = 'Basic ' + Buffer.from(rpcUser + ':' + rpcPWD).toString('base64');
    }

    randomString = length => {
        let res = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < length; i++) {
            res += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return res;
    }

    call = (method, params) =>
    {
        return new Promise(resolve => {
            // const nonce = 'X' + this.randomString(32);
            const postData = JSON.stringify({
                method: method,
                params: params,
                id: 1
              });
            // const data = '{ "jsonrpc" : "1.0", "id" : "' + nonce + '", "method" : "' + method + '", "params" : ' + JSON.stringify(params) + ' }';
            axios.post(this.url, postData, {
                headers: {
                    'content-type': 'application/json',
                    'Authorization': this.authHeader
                }
            }).then(res => {
                resolve(res.data);
            })
        });
    }

    getNetworkServices = async () => {
        const res = await this.call('xrGetNetworkServices', []);
        return res;
    }

    connect = async (service, node_count = 1) => {
        const res = await this.call('xrConnect', [service, node_count]);
        return res;
    }

    getBlockCount = async (blockchain, node_count = 1) => {
        const res = await this.call('xrGetBlockCount', [blockchain, node_count]);
        return res;
    }
}

exports.default = RPCInterface;