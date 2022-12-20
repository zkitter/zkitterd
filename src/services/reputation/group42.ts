import Web3 from 'web3';
// @ts-ignore
// eslint-disable-next-line import/no-unresolved
import { Contract } from 'web3-eth-contract';

import { sequelize } from '@util/sequelize';
import semaphore from '@models/semaphore';
import { GenericService } from '@util/svc';
import app from '@models/app';
import config from '@util/config';
import { semaphoreABI } from '@util/abi';

export default class Group42 extends GenericService {
  semaphore?: ReturnType<typeof semaphore>;
  app: ReturnType<typeof app>;
  web3: Web3;
  contract: Contract;

  constructor(opts: { app: ReturnType<typeof app> }) {
    super();
    const httpProvider = new Web3.providers.HttpProvider(config.goerliHttpProvider);
    this.web3 = new Web3(httpProvider);
    this.contract = new this.web3.eth.Contract(
      semaphoreABI as any,
      '0xE585f0Db9aB24dC912404DFfb9b28fb8BF211fA6'
    );
    this.app = opts.app;
  }

  async start() {
    this.semaphore = await semaphore(sequelize);
  }

  async sync() {
    const data = await this.app.read();
    const lastBlock = data?.lastGroup42BlockScanned;
    const block = await this.web3.eth.getBlock('latest');
    const toBlock = Math.min(block.number, lastBlock + 99999);

    const events = await this.contract.getPastEvents('MemberAdded', {
      fromBlock: lastBlock,
      toBlock: toBlock,
    });

    for (const event of events) {
      const identityCommitment = event.returnValues.identityCommitment;
      const groupId = event.returnValues.groupId;
      const merkleTreeRoot = event.returnValues.merkleTreeRoot;
      const idCommitmentHex = BigInt(identityCommitment).toString(16);
      const exist = await this.semaphore?.findOne(idCommitmentHex, 'semaphore_taz_members');

      if (!exist && (groupId === '10806' || groupId === '42' || groupId === '10807')) {
        await this.semaphore?.addID(idCommitmentHex, 'semaphore_taz_members', merkleTreeRoot);
      }
    }

    await this.app!.updateLastGroup42BlockScanned(toBlock);

    if (block.number > toBlock) {
      await this.sync();
    }
  }
}
