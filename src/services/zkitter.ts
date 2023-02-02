import { GenericService } from '@util/svc';
import { Zkitter } from 'zkitter-js';
import config from '@util/config';
import { PostgresAdapter } from '@services/db/adapter';
import DBService from '@services/db';
import logger from '@util/logger';

export default class ZkitterService extends GenericService {
  node?: Zkitter;

  async start() {
    const dbSvc = this.main?.services['db'] as DBService;
    const db = new PostgresAdapter(dbSvc);
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
  }
}
