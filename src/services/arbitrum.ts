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
        this.web3.eth.accounts.wallet.add(config.arbitrumPrivateKey);
        this.registrar = new this.web3.eth.Contract(
            arbRegistrarABI as any,
            config.arbitrumRegistrar,
        );
    }

    getNonce = async (account: string): Promise<string> => {
        return this.registrar.methods.nonces(account).call();
    }

    updateFor = async (account: string, pubkey: string, proof: string) => {
        const pubkeyBytes = this.web3.utils.utf8ToHex(pubkey);
        return await this.registrar.methods.updateFor(account, pubkeyBytes, proof).send({
            from: config.arbitrumAddress,
            gas: '10000000',
        });
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
            const toBlock = Math.min(block.number, lastBlock + 99999);

            const events = await this.registrar.getPastEvents('RecordUpdatedFor', {
                fromBlock: lastBlock,
                toBlock: toBlock,
            });
            logger.info('scanned Autism Registrar on arbitrum', {
                fromBlock: lastBlock,
                toBlock: toBlock,
            });


            for (let event of events) {
                const tx = await this.web3.eth.getTransaction(event.transactionHash);
                const block = await this.web3.eth.getBlock(event.blockNumber);

                const pubkeyBytes = event.returnValues.value;
                const account = event.returnValues.account;
                const pubkey = Web3.utils.hexToUtf8(pubkeyBytes);

                const x = pubkey.split('.')[0];
                const y = pubkey.split('.')[1];

                if (x.length !== 43 || y.length !== 43) {
                    logger.error('invalid pubkey', {
                        fromBlock: lastBlock,
                        toBlock: block.number,
                    });
                    continue;
                }

                const users = await this.call('db', 'getUsers');
                await users.updateOrCreateUser({
                    name: account,
                    pubkey,
                    joinedAt: Number(block.timestamp) * 1000,
                    tx: tx.hash,
                    type: 'arbitrum',
                });

                await this.call('gun', 'watch', pubkey);

                logger.info(`added pubkey for ${account}`, {
                    transactionHash: tx.hash,
                    blockNumber: tx.blockNumber,
                    name: account,
                    pubkey: pubkey,
                    fromBlock: lastBlock,
                });
            }
            await app.updateLastArbitrumBlock(toBlock);
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