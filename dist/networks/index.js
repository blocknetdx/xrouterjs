"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Networks = void 0;
const bitcore_lib_1 = __importDefault(require("bitcore-lib"));
const block_1 = require("./block");
bitcore_lib_1.default.Networks.add(block_1.blockMainnet);
exports.Networks = {
    MAINNET: bitcore_lib_1.default.Networks.get(block_1.blockMainnet.name, ['name']),
};
//# sourceMappingURL=index.js.map