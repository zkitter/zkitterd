import 'isomorphic-fetch';
import ArbitrumService from './services/arbitrum';
import DBService from './services/db';
import ENSService from './services/ens';
import GunService from './services/gun';
import HttpService from './services/http';
import {
  AuthController,
  EventsController,
  InterepController,
  MerkleController,
  MiscController,
  PostsController,
  TagsController,
  TwitterController,
  UsersController,
  ZkChatController,
} from './services/http/controllers';
import InterrepService from './services/interrep';
import IPFSService from './services/ipfs';
import MerkleService from './services/merkle';
import { ReputationService } from './services/reputation';
import ZKChatService from './services/zkchat';
import logger from './util/logger';
import { MainService } from './util/svc';

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

    main.add('authController', new AuthController());
    main.add('interepController', new InterepController());
    main.add('eventsController', new EventsController());
    main.add('merkleController', new MerkleController());
    main.add('miscController', new MiscController());
    main.add('postsController', new PostsController());
    main.add('usersController', new UsersController());
    main.add('tagsController', new TagsController());
    main.add('twitterController', new TwitterController());
    main.add('zkChatController', new ZkChatController());
    main.add('reputation', new ReputationService());
    await main.start();
  } catch (e) {
    logger.error(e.message, { stack: e.stack });
    throw e;
  }
})();
