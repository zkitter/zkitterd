import { GenericService } from '../util/svc';
import config from '../util/config';
import { CIDString, Filelike, Web3Storage } from 'web3.storage';

export default class IPFSService extends GenericService {
  client: Web3Storage;

  constructor() {
    super();
    // @ts-ignore
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
