import { Request, RequestHandler, Response, Router } from 'express';
import passport from 'passport';
import { Strategy as GhStrategy } from 'passport-github2';
import { Strategy as TwitterStrategy } from '@superfaceai/passport-twitter-oauth2';
import { calculateReputation, OAuthProvider } from '@interep/reputation';

import { Controller } from './interface';
import config from '../../../util/config';
import { getReceivedStars } from '../../../util/github';

const { ghCallbackUrl, ghClientId, ghClientSecret, twCallbackUrl, twClientId, twClientSecret } =
  config;

type GhProfile = {
  id: string;
  provider: string;
  username: string;
  _json: {
    followers: number;
    plan: { name: string };
  };
};

type TwProfile = {
  id: string;
  username: string;
};

export class AuthController extends Controller {
  prefix = '/auth';
  redirectUrl: string;

  constructor() {
    super();
    passport.use(
      new GhStrategy(
        {
          clientID: ghClientId,
          clientSecret: ghClientSecret,
          callbackURL: ghCallbackUrl,
        },
        async (accessToken: string, refreshToken: string, profile: GhProfile, done: any) => {
          const {
            id: userId,
            provider,
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

          const db = await this.call('db', 'getAuth');

          await db.upsertOne({ provider, userId, username, token: accessToken });

          return done(null, {
            provider,
            username,
            reputation,
          });
        }
      )
    );

    passport.use(
      // @ts-ignore
      new TwitterStrategy(
        {
          clientType: 'public',
          clientID: twClientId,
          clientSecret: twClientSecret,
          callbackURL: twCallbackUrl,
        },
        async (accessToken, refreshToken, profile, done) => {
          const { provider, id: userId, username } = profile;

          const db = await this.call('db', 'getAuth');

          await db.upsertOne({ provider, userId, username, token: accessToken });

          // TODO get twitter followers/reputation
          // @ts-ignore
          return done(null, {
            provider,
            username,
            // reputation,
          });
        }
      )
    );

    this.addRoutes();
  }

  addRoutes = () => {
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
          passport.authenticate('twitter', { scope: ['follows.read'] })
        )
        .get('/callback', passport.authenticate('twitter'), this.callback)
    );
  };

  callback = (req: Request, res: Response) => {
    console.log(req.user);
    res.redirect(this.redirectUrl);
  };

  storeRedirectUrl: RequestHandler<{}, {}, {}, { redirectUrl: string }> = (req, res, next) => {
    this.redirectUrl = req.query.redirectUrl;
    next();
  };
}
