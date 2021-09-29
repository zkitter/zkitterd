import {GenericService} from "../util/svc";
import {Contract} from "web3-eth-contract";
import interrep from "../util/interrep";
import Timeout = NodeJS.Timeout;
import logger from "../util/logger";
import Web3 from "web3";
import config from "../util/config";

export default class InterrepService extends GenericService {
    interrep: Contract;
    web3: Web3;
    scanTimeout?: Timeout | null;

    constructor() {
        super();
        const httpProvider = new Web3.providers.HttpProvider('https://kovan.infura.io/v3/4ccf3cd743eb42b5a8cb1c8b0c0160ee');
        this.web3 = new Web3(httpProvider);
        this.interrep = interrep;
    }

    async scanFromLast() {
        const app = await this.call('db', 'getApp');
        const semaphore = await this.call('db', 'getSemaphore');
        const data = await app.read();

        logger.info('scanning ens TextChanged events', {
            fromBlock: data?.lastInterrepBlockScanned,
        });

        try {
            const block = await this.web3.eth.getBlock('latest');
            const events = await this.interrep.getPastEvents('NewRootHash', {
                fromBlock: data?.lastInterrepBlockScanned,
                toBlock: block.number,
            });
            await app.updateLastInterrepBlock(block.number);
            logger.info('scanned ens TextChanged events', {
                fromBlock: data?.lastInterrepBlockScanned,
                toBlock: block.number,
            });

            for (let event of events) {
                await semaphore.addID(
                    BigInt(event.returnValues._identityCommitment).toString(16),
                    event.returnValues._groupId,
                    BigInt(event.returnValues._rootHash).toString(16),
                );

                logger.info(`added roothash`, {
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                    fromBlock: data?.lastInterrepBlockScanned,
                });
            }
        } catch (e) {
            logger.error(e.message, {
                parent: e.parent,
                stack: e.stack,
                fromBlock: data?.lastInterrepBlockScanned,
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