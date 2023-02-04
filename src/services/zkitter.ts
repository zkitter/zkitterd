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
    this.node = await Zkitter.initialize({
      db,
      arbitrumProvider: config.arbitrumProvider || config.arbitrumHttpProvider || '',
    });

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

    await this.node.watchArbitrum();
    await this.node.subscribe();
    // await this.node.queryHistory();
    await this.node.getPostMeta('17d6a0d28cfe886aeca68d8d42163694a59fae9f3ab25276c6b26e4ac6d56e81');
    // await this.node.getGroupMembers('semaphore_taz_members');
  }
}
