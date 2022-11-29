import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import passport from 'passport';
import { Strategy as GhStrategy } from 'passport-github2';
import { calculateReputation, OAuthProvider } from '@interep/reputation';

import { Controller } from './interface';
import config from '../../../util/config';
import { getReceivedStars } from '../../../util/github';
import { makeResponse } from '../utils';

type GhUser = {
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

          await githubAuthDB.upsertOne({ username, token: accessToken });

          return done(null, {
            provider: 'github',
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
        .get('/test', (req, res) => {
          res.json(req.user);
        })
    );
  };

  callback = (req: Request, res: Response) => {
    res.redirect(this.redirectUrl);
  };

  storeRedirectUrl: RequestHandler<{}, {}, {}, { redirectUrl: string }> = (req, res, next) => {
    this.redirectUrl = req.query.redirectUrl;
    next();
  };
}
