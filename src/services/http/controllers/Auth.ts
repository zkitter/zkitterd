import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import passport from 'passport';
import { OAuthProvider } from '@interep/reputation';

import { Controller } from './interface';
import { makeResponse } from '../utils';
import { getProfileParams, GhProfile, RdProfile, STRATEGIES, TwProfile } from '@util/auth';
import logger from '@util/logger';

export class AuthController extends Controller {
  prefix = '/auth';
  redirectUrl: string;

  constructor() {
    super();
    Object.entries(STRATEGIES).forEach(([provider, { options }]) => {
      this.createStrategy(provider as OAuthProvider, options);
    });

    this.addRoutes();
  }

  createStrategy = (provider: OAuthProvider, options: any) => {
    passport.use(
      new STRATEGIES[provider].Strategy(
        options,
        async (
          accessToken: string,
          refreshToken: string,
          profile: GhProfile | RdProfile | TwProfile,
          done: (err?: Error | null, user?: Express.User, info?: object) => void
        ) => {
          try {
            const { reputation, userId, username } = await getProfileParams(profile, provider);
            const db = await this.call('db', 'getAuth');
            await db.upsertOne({ provider, userId, username, token: accessToken });

            return done(null, {
              provider,
              username,
              reputation,
            });
          } catch (e) {
            logger.error(e.message, { stack: e.stack });
            return done(e);
          }
        }
      )
    );
  };

  addRoutes = () => {
    this._router.get('/session', this.session).get('/logout', this.logout);

    Object.entries(STRATEGIES).forEach(([provider, { scope }]) => {
      this._router.use(
        `/${provider}`,
        Router()
          .get('', this.storeRedirectUrl, passport.authenticate(provider, { scope }))
          .get('/callback', passport.authenticate(provider), this.callback)
      );
    });
  };

  callback = (req: Request, res: Response) => {
    res.redirect(this.redirectUrl);
  };

  // eslint-disable-next-line @typescript-eslint/ban-types
  storeRedirectUrl: RequestHandler<{}, {}, {}, { redirectUrl: string }> = (req, res, next) => {
    this.redirectUrl = req.query.redirectUrl;
    next();
  };

  session = (req: Request, res: Response) => {
    if (req.user) {
      res.status(200).json({ payload: req.user });
    } else {
      res.status(401).json({ error: 'not authenticated' });
    }
  };

  logout = (req: Request, res: Response, next: NextFunction) => {
    req.logout(err => {
      if (err) return next(err);
      res.send(makeResponse('ok'));
    });
  };
}
