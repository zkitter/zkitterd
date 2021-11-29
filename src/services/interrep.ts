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
        const lastBlock = data?.lastInterrepBlockScanned;
        logger.info('scanning interrep IdentityCommitmentAdded events', {
            fromBlock: data?.lastInterrepBlockScanned,
        });

        try {
            const block = await this.web3.eth.getBlock('latest');
            const toBlock = Math.min(block.number, lastBlock + 99999);

            const events = await this.interrep.getPastEvents('IdentityCommitmentAdded', {
                fromBlock: data?.lastInterrepBlockScanned,
                toBlock: toBlock,
            });
            logger.info('scanned interrep IdentityCommitmentAdded events', {
                fromBlock: data?.lastInterrepBlockScanned,
                toBlock: toBlock,
            });

            for (let event of events) {
                try {
                    await semaphore.addID(
                        BigInt(event.returnValues.identityCommitment).toString(16),
                        Web3.utils.hexToUtf8(event.returnValues.provider),
                        Web3.utils.hexToUtf8(event.returnValues.name),
                        BigInt(event.returnValues.root).toString(16),
                    );
                } catch (e) {
                    logger.error(e.message, {
                        parent: e.parent,
                        stack: e.stack,
                        fromBlock: data?.lastInterrepBlockScanned,
                    });
                }


                logger.info(`added roothash`, {
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                    fromBlock: data?.lastInterrepBlockScanned,
                });
            }

            await app.updateLastInterrepBlock(toBlock);
            if (block.number > toBlock) return true;
        } catch (e) {
            logger.error(e.message, {
                parent: e.parent,
                stack: e.stack,
                fromBlock: data?.lastInterrepBlockScanned,
            });
        }
    }

    scan = async () => {
        const shouldScanAgain = await this.scanFromLast();

        if (this.scanTimeout) {
            clearTimeout(this.scanTimeout);
            this.scanTimeout = null;
        }

        this.scanTimeout = setTimeout(this.scan, shouldScanAgain ? 0 : 15000);
    }

    async start() {
        this.scan();
    }
}