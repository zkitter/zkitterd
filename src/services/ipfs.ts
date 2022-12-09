import { Web3Storage } from 'web3.storage';
import type { CIDString, Filelike } from 'web3.storage';

import { GenericService } from '@util/svc';
import config from '@util/config';

export default class IPFSService extends GenericService {
  client: Web3Storage;

  constructor() {
    super();
    this.client = new Web3Storage({
      token: config.web3StorageAPIKey as string,
    });
  }

  store = (files: Iterable<Filelike>): Promise<CIDString> => {
    return this.client.put(files);
  };

  status = (cid: CIDString) => {
    return this.client.status(cid);
  };
}
