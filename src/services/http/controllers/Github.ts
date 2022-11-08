import { Request, Response, Router } from 'express';
import passport from 'passport';
import { Strategy as GhStrategy } from 'passport-github2';

import { Controller } from './interface';
import config from '../../../util/config';

export class GithubController extends Controller {
  constructor() {
    super();
    passport.use(
      new GhStrategy(
        {
          clientID: config.ghClientId,
          clientSecret: config.ghClientSecret,
          callbackURL: config.ghCallbackUrl,
        },
        // @ts-ignore
        async (accessToken, refreshToken, profile, done) => {
          const {
            id: userId,
            username,
            displayName,
            _json: { followers },
          } = profile;
          const githubAuthDB = await this.call('db', 'getGithubAuth');
          await githubAuthDB.upsertOne({
            userId,
            username,
            displayName,
            followers,
          });
          return done(null, { userId, username, displayName, followers });
        }
      )
    );

    this.addRoutes();
  }

  addRoutes = () => {
    this._router.use(
      '/auth/github',
      Router()
        .get('', passport.authenticate('github', { scope: ['read:user', 'read:org'] }))
        .get('/callback', passport.authenticate('github', { failWithError: true }), this.callback)
      // .get('/test', (req, res) => {
      //   res.json(req.user);
      // })
    );
  };

  callback = (req: Request, res: Response) => {
    res.send('gh callback');
  };
}
