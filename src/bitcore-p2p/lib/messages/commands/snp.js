'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore-lib');
var BufferWriter = bitcore.encoding.BufferWriter;
var BufferReader = bitcore.encoding.BufferReader;

// var BN = bitcore.crypto.BN;
var utils = require('../utils');
// var packageInfo = require('../../../package.json');

/**
 * The version message is used on connection creation to advertise
 * the type of node. The remote node will respond with its version, and no
 * communication is possible until both peers have exchanged their versions.
 *
 * @see https://en.bitcoin.it/wiki/Protocol_documentation#version
 * @param {Object=} arg - properties for the version message
 * @param {Buffer=} arg.nonce - a random 8 byte buffer
 * @param {String=} arg.subversion - version of the client
 * @param {BN=} arg.services
 * @param {Date=} arg.timestamp
 * @param {Number=} arg.startHeight
 * @param {Object} options
 * @extends Message
 * @constructor
 */
function SNPMessage(arg, options) {

    /* jshint maxcomplexity: 10 */
    if (!arg) {
        arg = {};
    }
    Message.call(this, options);
    this.command = 'snp';
}
inherits(SNPMessage, Message);

SNPMessage.prototype.setPayload = function(payload) {

    //  1 - compressed snode pubkey length
    // 33 - compressed snode pubkey
    //  4 - block height
    // 32 - block hash (256 bit)
    //  4 - ping time
    //  n - config len (can be uint8, uint16, uint32, uint64) + config string + null terminated string
    //  n - snode registration bytes (see MsgSnodeRegistration.MaxPayloadLength)
    //  1 - snode ping signature length
    // 65 - snode ping signature

    var parser = new BufferReader(payload);

    const res = {};

    res.pubKey = parser.readVarLengthBuffer();

    res.blockHeight = parser.readUInt32LE();
    res.blockHash = parser.read(32);
    res.pingTime = parser.readUInt32LE();
    res.config = JSON.parse(parser.readVarLengthBuffer().toString());

    const regBytesLen = payload.length - parser.pos - 66;
    res.snodeReg = parser.read(regBytesLen);
    res.pingSignature = parser.readVarLengthBuffer();

    Object.assign(this, res);

    utils.checkFinished(parser);
};

SNPMessage.prototype.getPayload = function() {
    var bw = new BufferWriter();
    return bw.concat();
};

module.exports = SNPMessage;
