import 'express-async-errors';
import cors from 'cors';
import express, { Express, json } from 'express';
import session from 'express-session';
import http from 'http';
import passport from 'passport';

import config from '@util/config';
import logger from '@util/logger';
import { sequelize } from '@util/sequelize';
import { GenericService } from '@util/svc';

import { CORS_OPTIONS, SESSION_OPTIONS } from './constants';
import { staticRouter } from './controllers';
import { logAfter, logBefore } from './middlewares/log';

const SequelizeStore = require('connect-session-sequelize')(session.Store);

export default class HttpService extends GenericService {
  app: Express;
  httpServer: any;

  controllers = [
    'auth',
    'events',
    'interep',
    'merkle',
    'misc',
    'posts',
    'tags',
    'twitter', // TODO: remove (to be superseded by Auth Controller)
    'users',
    'zkChat',
  ];

  constructor() {
    super();
    this.app = express();
  }

  addRoutes() {
    this.controllers.forEach(controller => {
      this.app.use(this.get(`${controller}Controller`, 'router'));
    });
    this.app.use(staticRouter);
  }

  async start() {
    const httpServer = http.createServer(this.app);
    const sessionStore = new SequelizeStore({
      db: sequelize,
    });

    this.app.set('trust proxy', 1);

    this.app.use(cors(CORS_OPTIONS));
    this.app.use(session({ ...SESSION_OPTIONS, store: sessionStore }));

    sessionStore.sync();

    this.app.use(passport.initialize());
    this.app.use(passport.session());

    passport.serializeUser((user, done) => {
      done(null, user);
    });
    passport.deserializeUser(
      (user: { username: string; provider: string; reputation: string }, done) => {
        this.call('db', 'getAuth')
          .then(db => {
            db.findTokenByUserId(user.username)
              .then((token: string | undefined) => {
                done(null, { token, ...user });
              })
              .catch((e: any) => {
                done(e, null);
              });
          })
          .catch(e => {
            done(e, null);
          });
      }
    );

    this.app.use(logBefore, json());
    this.addRoutes();
    this.app.use(logAfter);

    this.httpServer = httpServer.listen(config.port);
    logger.info(`api server listening at ${config.port}...`);
  }
}
