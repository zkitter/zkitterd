import { GenericService } from '@util/svc';
import { Zkitter } from 'zkitter-js';
import config from '@util/config';
import { PostgresAdapter } from '@services/db/adapter';
import DBService from '@services/db';
import logger from '@util/logger';
import MerkleService from '@services/merkle';
import ENSService from '@services/ens';
import ZKChatService from '@services/zkchat';

export default class ZkitterService extends GenericService {
  node?: Zkitter;

  async start() {
    const dbSvc = this.main?.services['db'] as DBService;
    const merkleSvc = this.main?.services['merkle'] as MerkleService;
    const ensSvc = this.main?.services['ens'] as ENSService;
    const zkchatSvc = this.main?.services['zkchat'] as ZKChatService;
    const db = new PostgresAdapter(dbSvc, merkleSvc, ensSvc, zkchatSvc);
    const opts: any = {
      db,
      arbitrumProvider: config.arbitrumProvider || config.arbitrumHttpProvider || '',
      filterOptions: { all: true },
    };

    if (process.env.NODE_ENV !== 'production') opts.topicPrefix = 'zkitter-dev';

    this.node = await Zkitter.initialize(opts);

    this.node.on('Users.ArbitrumSynced', data => {
      const { latest, fromBlock, toBlock } = data;
      const completion = ((fromBlock / latest) * 100).toFixed(2);

      logger.debug(
        `Synced with Arbitrum Mainnet from block #${fromBlock} to #${toBlock}(${completion}%)`
      );
    });

    this.node.on('Users.NewUserCreated', data => {
      logger.debug(`New user added - @${data.address}`);
    });

    this.node.on('Zkitter.NewMessageCreated', data => {
      console.log(data);
    });

    this.node.on('Group.GroupSynced', console.log.bind(console));
    this.node.on('History.Download', console.log.bind(console));

    await this.node.start();
    await this.node.downloadHistoryFromAPI();
  }
}
