import passport from 'passport';
import { Strategy as GhStrategy } from 'passport-github2';

import config from '../../util/config';
import { GenericService } from '../../util/svc';

const ghStrategy = new GhStrategy(
  {
    clientID: config.ghClientId,
    clientSecret: config.ghClientSecret,
    callbackURL: config.ghCallbackUrl,
  },
  // @ts-ignore
  async (accessToken, refreshToken, profile, done) => {
    // TODO
    // add user to auth db

    return done(null, profile);
  }
);

// const twitterStrategy = new TwitterStrategy()

export class PassportService extends GenericService {
  constructor() {
    super();
    passport.serializeUser((user, done) => {
      done(null, user);
    });

    passport.deserializeUser<any>((obj, done) => {
      done(null, obj);
    });
    passport.use(ghStrategy);
    // passport.use(twitterStrategy)
  }
}
