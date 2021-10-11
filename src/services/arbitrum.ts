import {GenericService} from "../util/svc";
import {Contract} from "web3-eth-contract";
import Web3 from "web3";
import config from "../util/config";
import logger from "../util/logger";
import Timeout = NodeJS.Timeout;
import {arbRegistrarABI} from "../util/abi";

export default class ArbitrumService extends GenericService {
    web3: Web3;
    registrar: Contract;
    scanTimeout?: Timeout | null;

    constructor() {
        super();
        const httpProvider = new Web3.providers.HttpProvider(config.arbitrumHttpProvider);
        this.web3 = new Web3(httpProvider);
        this.registrar = new this.web3.eth.Contract(
            arbRegistrarABI as any,
            config.arbitrumRegistrar,
        );
    }

    async scanFromLast() {
        const app = await this.call('db', 'getApp');
        const data = await app.read();
        const lastBlock = data?.lastArbitrumBlockScanned;

        logger.info('scanning Autism Registrar on arbitrum', {
            fromBlock: lastBlock,
        });

        try {
            const block = await this.web3.eth.getBlock('latest');
            const events = await this.registrar.getPastEvents('RecordUpdatedFor', {
                fromBlock: lastBlock,
                toBlock: block.number,
            });
            await app.updateLastArbitrumBlock(block.number);
            logger.info('scanned Autism Registrar on arbitrum', {
                fromBlock: data?.lastArbitrumBlockScanned,
                toBlock: block.number,
            });

            // for (let event of events) {
            //     const addr = await this.resolver.methods.addr(event.returnValues.node).call();
            //     const { name } = await this.ens.getName(addr);
            //     const tx = await this.web3.eth.getTransaction(event.transactionHash);
            //     const block = await this.web3.eth.getBlock(event.blockNumber);
            //     const params = this.web3.eth.abi.decodeParameters(
            //         ['bytes32', 'string', 'string'],
            //         tx.input.slice(10),
            //     );
            //     const pubkey = params[2];
            //     const x = pubkey.split('.')[0];
            //     const y = pubkey.split('.')[1];
            //
            //     if (x.length !== 43 || y.length !== 43) {
            //         logger.error('invalid pubkey', {
            //             fromBlock: lastBlock,
            //             toBlock: block.number,
            //         });
            //         continue;
            //     }
            //
            //     const users = await this.call('db', 'getUsers');
            //     await users.updateOrCreateUser({
            //         name,
            //         pubkey,
            //         joinedAt: Number(block.timestamp) * 1000,
            //     });
            //
            //     await this.call('gun', 'watch', pubkey);
            //
            //     logger.info(`added pubkey for ${name}`, {
            //         transactionHash: tx.hash,
            //         blockNumber: tx.blockNumber,
            //         name: name,
            //         pubkey: pubkey,
            //         fromBlock: lastBlock,
            //     });
            // }
        } catch (e) {
            logger.error(e.message, {
                parent: e.parent,
                stack: e.stack,
                fromBlock: lastBlock,
            });
        }
    }

    scan = async () => {
        await this.scanFromLast();

        if (this.scanTimeout) {
            clearTimeout(this.scanTimeout);
            this.scanTimeout = null;
        }

        this.scanTimeout = setTimeout(this.scan, 15000);
    }

    async start() {
        this.scan();
    }
}