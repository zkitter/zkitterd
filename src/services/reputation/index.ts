import Group42 from './group42';

import { GenericService } from '@util/svc';

export class ReputationService extends GenericService {
  group42?: Group42;

  async start() {
    const app = await this.call('db', 'getApp');
    this.group42 = new Group42({
      app,
    });
    await this.group42.start();
    this.sync();
  }

  sync = async () => {
    await this.group42!.sync();
    setTimeout(this.sync, 30000);
  };
}
