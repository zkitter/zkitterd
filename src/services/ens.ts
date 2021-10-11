import {GenericService} from "../util/svc";
import {Contract} from "web3-eth-contract";
import Web3 from "web3";
import config from "../util/config";
import {ensResolverABI} from "../util/abi";
import logger from "../util/logger";
import Timeout = NodeJS.Timeout;

const {
    default: ENS,
    getEnsAddress,
} = require('@ensdomains/ensjs');

const cachedName: any = {};

export default class ENSService extends GenericService {
    web3: Web3;
    resolver: Contract;
    ens: typeof ENS;
    scanTimeout?: Timeout | null;

    constructor() {
        super();
        const httpProvider = new Web3.providers.HttpProvider(config.web3HttpProvider);
        this.web3 = new Web3(httpProvider);
        this.resolver = new this.web3.eth.Contract(
            ensResolverABI as any,
            config.ensResolver,
        );
        this.ens = new ENS({
            provider: httpProvider,
            ensAddress: getEnsAddress('1'),
        });
    }

    fetchNameByAddress = async (address: string) => {
        if (typeof cachedName[address] !== 'undefined') {
            return cachedName[address];
        }

        const {name} = await this.ens.getName(address);
        cachedName[address] = name || null;
        setTimeout(() => delete cachedName[address], 1000 * 60 * 60 * 48);
        return name;
    }

    fetchAddressByName = async (name: string) => {
        if (Web3.utils.isAddress(name)) return name;

        if (typeof cachedName[name] !== 'undefined') {
            return cachedName[name];
        }

        const address = await this.ens.name(name).getAddress();

        if (!address) throw new Error(`cannot find address for ${name}`);
        cachedName[name] = address || null;
        setTimeout(() => delete cachedName[name], 1000 * 60 * 60 * 48);
        return address;
    }

    async scanFromLast() {
        const app = await this.call('db', 'getApp');
        const data = await app.read();

        logger.info('scanning ens TextChanged events', {
            fromBlock: data?.lastENSBlockScanned,
        });

        try {
            const block = await this.web3.eth.getBlock('latest');
            const events = await this.resolver.getPastEvents('TextChanged', {
                fromBlock: data?.lastENSBlockScanned,
                toBlock: block.number,
                topics: [
                    null,
                    null,
                    this.web3.utils.sha3('gun.social'),
                ],
            });
            await app.updateLastENSBlock(block.number);
            logger.info('scanned ens TextChanged events', {
                fromBlock: data?.lastENSBlockScanned,
                toBlock: block.number,
            });

            for (let event of events) {
                const addr = await this.resolver.methods.addr(event.returnValues.node).call();
                const username = addr;
                // const { name } = await this.ens.getName(addr);
                const tx = await this.web3.eth.getTransaction(event.transactionHash);
                const block = await this.web3.eth.getBlock(event.blockNumber);
                const params = this.web3.eth.abi.decodeParameters(
                    ['bytes32', 'string', 'string'],
                    tx.input.slice(10),
                );
                const pubkey = params[2];
                const x = pubkey.split('.')[0];
                const y = pubkey.split('.')[1];

                if (x.length !== 43 || y.length !== 43) {
                    logger.error('invalid pubkey', {
                        fromBlock: data?.lastENSBlockScanned,
                        toBlock: block.number,
                    });
                    continue;
                }

                const users = await this.call('db', 'getUsers');
                await users.updateOrCreateUser({
                    name: username,
                    pubkey,
                    joinedAt: Number(block.timestamp) * 1000,
                    tx: event.transactionHash,
                    type: 'ens',
                });

                await this.call('gun', 'watch', pubkey);

                logger.info(`added pubkey for ${username}`, {
                    transactionHash: tx.hash,
                    blockNumber: tx.blockNumber,
                    name: username,
                    pubkey: pubkey,
                    fromBlock: data?.lastENSBlockScanned,
                });
            }
        } catch (e) {
            logger.error(e.message, {
                parent: e.parent,
                stack: e.stack,
                fromBlock: data?.lastENSBlockScanned,
            });
        }
    }

    scan = async () => {
        await this.scanFromLast();

        // if (this.scanTimeout) {
        //     clearTimeout(this.scanTimeout);
        //     this.scanTimeout = null;
        // }

        // this.scanTimeout = setTimeout(this.scan, 15000);
    }

    async start() {
        this.scan();
    }
}