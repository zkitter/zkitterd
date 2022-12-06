import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import passport from 'passport';
import { OAuthProvider } from '@interep/reputation';

import { Controller } from './interface';
import { makeResponse } from '../utils';
import { getProfileParams, GhProfile, RdProfile, STRATEGIES, TwProfile } from '../../../util/auth';

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
          done: any
        ) => {
          const { reputation, userId, username } = await getProfileParams(profile, provider);
          const db = await this.call('db', 'getAuth');
          await db.upsertOne({ provider, userId, username, token: accessToken });

          // @ts-ignore
          return done(null, {
            provider,
            username,
            reputation,
          });
        }
      )
    );
  };

  addRoutes = () => {
    this._router.get('/session', this.session).get('/logout', this.logout);

    this._router.use(
      '/github',
      Router()
        .get(
          '',
          this.storeRedirectUrl,
          passport.authenticate('github', { scope: ['read:user', 'read:org'] })
        )
        .get('/callback', passport.authenticate('github'), this.callback)
        .get('/test', (req, res) => {
          res.json(req.user);
        })
    );

    this._router.use(
      '/twitter',
      Router()
        .get(
          '',
          this.storeRedirectUrl,
          passport.authenticate('twitter', {
            scope: ['tweet.read', 'users.read', 'offline.access', 'follows.read'],
          })
        )
        .get('/callback', passport.authenticate('twitter'), this.callback)
    );
    this._router.use(
      '/reddit',
      Router()
        .get('', this.storeRedirectUrl, passport.authenticate('reddit', { scope: ['identity'] }))
        .get('/callback', passport.authenticate('reddit'), this.callback)
    );
  };

  callback = (req: Request, res: Response) => {
    res.redirect(this.redirectUrl);
  };

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
    // @ts-ignore
    req.logout(err => {
      if (err) return next(err);
      res.send(makeResponse('ok'));
    });
  };
}
