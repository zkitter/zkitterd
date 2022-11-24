import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import passport from 'passport';
import { Strategy as GhStrategy } from 'passport-github2';
import { calculateReputation, OAuthProvider } from '@interep/reputation';

import { Controller } from './interface';
import config from '../../../util/config';
import { getReceivedStars } from '../../../util/github';
import { makeResponse } from '../utils';

type GhUser = {
  id: string;
  username: string;
  _json: {
    followers: number;
    plan: { name: string };
  };
};

export class GithubController extends Controller {
  redirectUrl: string;

  constructor() {
    super();
    passport.use(
      new GhStrategy(
        {
          clientID: config.ghClientId,
          clientSecret: config.ghClientSecret,
          callbackURL: config.ghCallbackUrl,
        },
        async (accessToken: string, refreshToken: string, profile: GhUser, done: any) => {
          const {
            id: userId,
            username,
            _json: {
              followers,
              plan: { name: planName },
            },
          } = profile;

          const proPlan = planName === 'pro';
          const receivedStars = await getReceivedStars(username);
          const reputation = calculateReputation(OAuthProvider.GITHUB, {
            followers,
            receivedStars,
            proPlan,
          });

          const githubAuthDB = await this.call('db', 'getGithubAuth');

          await githubAuthDB.upsertOne({ userId, accessToken });

          return done(null, {
            provider: 'github',
            userId,
            username,
            reputation,
          });
        }
      )
    );

    this.addRoutes();
  }

  addRoutes = () => {
    this._router.use(
      '/auth/github',
      Router()
        .get(
          '',
          this.storeRedirectUrl,
          passport.authenticate('github', { scope: ['read:user', 'read:org'] })
        )
        .get('/callback', passport.authenticate('github'), this.callback)
        .get('/logout', this.logout)
    );
  };

  callback = (req: Request, res: Response) => {
    res.redirect(this.redirectUrl);
  };

  storeRedirectUrl: RequestHandler<{}, {}, {}, { redirectUrl: string }> = (req, res, next) => {
    this.redirectUrl = req.query.redirectUrl;
    next();
  };

  logout = (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    req.logout(err => {
      if (err) return next(err);
      res.send(makeResponse('ok'));
    });
  };
}
