"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Service = void 0;
class Service {
    constructor(data) {
        this.clientRequestLimit = 0;
        this.disabled = false;
        this.fee = '0';
        this.fetchLimit = 0;
        this.help = '';
        this.name = data.name;
        this.clientRequestLimit = data.clientRequestLimit || this.clientRequestLimit;
        this.disabled = data.disabled || this.disabled;
        this.fee = data.fee || this.fee;
        this.fetchLimit = data.fetchLimit || this.fetchLimit;
        this.help = data.help || this.help;
    }
}
exports.Service = Service;
//# sourceMappingURL=service.js.map