import cors from 'cors';
import express, { Express, json } from 'express';
import 'express-async-errors';
import session from 'express-session';
import http from 'http';

import { corsOptions } from './constants';
import { staticRouter } from './controllers';
import { logAfter, logBefore } from './middlewares/log';
import { GenericService } from '../../util/svc';
import logger from '../../util/logger';
import config from '../../util/config';
import { sequelize } from '../../util/sequelize';

const SequelizeStore = require('connect-session-sequelize')(session.Store);

export default class HttpService extends GenericService {
  app: Express;
  httpServer: any;

  controllers = [
    'events',
    'interep',
    'merkle',
    'misc',
    'posts',
    'tags',
    'twitter',
    'users',
    'zkChat',
  ];

  constructor() {
    super();
    this.app = express();
  }

  initControllers() {
    this.controllers.forEach(controller => {
      this.app.use(this.get(`${controller}Controller`, 'router'));
    });
  }

  addRoutes() {
    this.initControllers();
    this.app.use(staticRouter);
  }

  async start() {
    const httpServer = http.createServer(this.app);
    const sessionStore = new SequelizeStore({
      db: sequelize,
    });

    this.app.set('trust proxy', 1);

    this.app.use(cors(corsOptions));
    this.app.use(
      session({
        proxy: true,
        secret: 'autistic cat',
        resave: false,
        saveUninitialized: false,
        store: sessionStore,
        cookie: {
          secure: false,
          maxAge: 30 * 24 * 60 * 60 * 1000,
        },
      })
    );

    sessionStore.sync();

    this.app.use(logBefore, json());
    this.addRoutes();
    this.app.use(logAfter);

    this.httpServer = httpServer.listen(config.port);
    logger.info(`api server listening at ${config.port}...`);
  }
}
