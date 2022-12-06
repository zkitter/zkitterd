import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import passport from 'passport';
import { Strategy as GhStrategy } from 'passport-github2';
import { calculateReputation, OAuthProvider } from '@interep/reputation';
import { Strategy as TwitterStrategy } from '@superfaceai/passport-twitter-oauth2';

import { Strategy as RedditStrategy } from '@r1oga/passport-reddit';

import { Controller } from './interface';
import config from '../../../util/config';
import { getReceivedStars } from '../../../util/github';
import { makeResponse } from '../utils';

const {
  ghCallbackUrl,
  ghClientId,
  ghClientSecret,
  rdCallbackUrl,
  rdClientId,
  rdClientSecret,
  twCallbackUrl,
  twClientId,
  twClientSecret,
} = config;

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
  provider: string;
  username: string;
};

type RdProfile = {
  id: string;
  name: string;
  provider: string;
  _json: {
    coins: number;
    has_subscribed_to_premium: boolean;
    linked_identities: any[];
    total_karma: number;
  };
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
        async (accessToken: string, refreshToken: string, profile: TwProfile, done: any) => {
          const { provider, id: userId, username } = profile;

          const db = await this.call('db', 'getAuth');

          await db.upsertOne({ provider, userId, username, token: accessToken });

          // const reputation = calculateReputation(OAuthProvider.TWITTER, {
          //   botometerOverallScore,
          //   followers,
          //   verifiedProfile,
          // });
          // @ts-ignore
          return done(null, {
            provider,
            username,
            // reputation,
          });
        }
      )
    );

    passport.use(
      // @ts-ignore
      new RedditStrategy(
        {
          clientID: rdClientId,
          clientSecret: rdClientSecret,
          callbackURL: rdCallbackUrl,
        },
        async (accessToken: string, refreshToken: string, profile: RdProfile, done: any) => {
          const {
            provider,
            id: userId,
            name: username,
            _json: {
              coins,
              has_subscribed_to_premium: premiumSubscription,
              linked_identities,
              total_karma: karma,
            },
          } = profile;

          const db = await this.call('db', 'getAuth');
          await db.upsertOne({ provider, userId, username, token: accessToken });

          const reputation = calculateReputation(OAuthProvider.REDDIT, {
            coins,
            karma,
            linkedIdentities: linked_identities.length,
            premiumSubscription,
          });

          // @ts-ignore
          return done(null, {
            provider,
            username,
            reputation,
          });
        }
      )
    );

    this.addRoutes();
  }

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
