import { Contract } from 'web3-eth-contract';
import Web3 from 'web3';
import LRU from 'lru-cache';

import { GenericService } from '@util/svc';
import config from '@util/config';
import { ensResolverABI } from '@util/abi';
import Timeout = NodeJS.Timeout;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { default: ENS, getEnsAddress } = require('@ensdomains/ensjs');

const cache = new LRU({
  max: 1000,
  maxAge: 60 * 60 * 1000,
});

export default class ENSService extends GenericService {
  web3: Web3;
  resolver: Contract;
  ens: typeof ENS;
  scanTimeout?: Timeout | null;

  constructor() {
    super();
    const httpProvider = new Web3.providers.HttpProvider(config.web3HttpProvider);
    this.web3 = new Web3(httpProvider);
    this.resolver = new this.web3.eth.Contract(ensResolverABI as any, config.ensResolver);
    this.ens = new ENS({
      provider: httpProvider,
      ensAddress: getEnsAddress('1'),
    });
  }

  ecrecover = async (data: string, sig: string) => {
    return this.web3.eth.accounts.recover(data, sig);
  };

  fetchNameByAddress = async (address: string) => {
    const cached = cache.get(address);

    if (cache.get(address)) {
      return cached;
    }

    const { name } = await this.ens.getName(address);

    if (!name) return null;

    cache.set(address, name);
    const ens = await this.call('db', 'getENS');
    await ens.update(name, address);
    return name;
  };

  fetchAddressByName = async (name: string) => {
    if (Web3.utils.isAddress(name)) return name;

    const cached = cache.get(name);

    if (cache.get(name)) {
      return cached;
    }

    const address = await this.ens.name(name).getAddress();

    if (!address) throw new Error(`cannot find address for ${name}`);

    cache.set(name, address);
    const ens = await this.call('db', 'getENS');
    await ens.update(name, address);

    return address;
  };
}
