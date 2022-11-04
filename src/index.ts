import 'isomorphic-fetch';
import { MainService } from './util/svc';
import ENSService from './services/ens';
import logger from './util/logger';
import DBService from './services/db';
import HttpService from './services/http';
import GunService from './services/gun';
import InterrepService from './services/interrep';
import ArbitrumService from './services/arbitrum';
import IPFSService from './services/ipfs';
import ZKChatService from './services/zkchat';
import MerkleService from './services/merkle';
import { ReputationService } from './services/reputation';
import {
  EventsController,
  PostsController,
  TagsController,
  UsersController,
  ZkChatController,
} from './services/http/controllers';

(async function initApp() {
  try {
    const main = new MainService();
    main.add('db', new DBService());
    main.add('merkle', new MerkleService());
    main.add('interrep', new InterrepService());
    main.add('zkchat', new ZKChatService());
    main.add('ens', new ENSService());
    main.add('arbitrum', new ArbitrumService());
    main.add('gun', new GunService());
    main.add('ipfs', new IPFSService());
    main.add('http', new HttpService());
    main.add('usersController', new UsersController());
    main.add('postsController', new PostsController());
    main.add('tagsController', new TagsController());
    main.add('zkChatController', new ZkChatController());
    main.add('eventsController', new EventsController());
    // main.add('twitterController', new TwitterController());
    // main.add('githubController', new GithubController());
    // main.add('interepController', new InterepController());
    main.add('reputation', new ReputationService());
    await main.start();
  } catch (e) {
    logger.error(e.message, { stack: e.stack });
    throw e;
  }
})();
