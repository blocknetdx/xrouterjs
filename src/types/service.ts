export interface ServiceData {
  name: string;
  clientRequestLimit: number;
  disabled: boolean;
  fee: string;
  fetchLimit: number;
  help: string;
}

export class Service {

  name: string;
  clientRequestLimit = 0;
  disabled = false;
  fee = '0';
  fetchLimit = 0;
  help = '';

  constructor(data: ServiceData) {
    this.name = data.name;
    this.clientRequestLimit = data.clientRequestLimit || this.clientRequestLimit;
    this.disabled = data.disabled || this.disabled;
    this.fee = data.fee || this.fee;
    this.fetchLimit = data.fetchLimit || this.fetchLimit;
    this.help = data.help || this.help;
  }

}
