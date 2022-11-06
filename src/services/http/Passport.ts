import passport from 'passport';
import TwitterStrategy from 'passport-twitter-token';

import config from '../../util/config';
import { GenericService } from '../../util/svc';

export class PassportService extends GenericService {
  constructor() {
    super();
    passport.use(
      new TwitterStrategy(
        {
          consumerKey: config.twConsumerKey,
          consumerSecret: config.twConsumerSecret,
        },
        // @ts-ignore
        async (userToken, userTokenSecret, profile, done) => {
          // TODO remove
          console.log({ profile });
          const twitterAuthDB = await this.call('db', 'getTwitterAuth');
          await twitterAuthDB.upsertUserToken({
            userToken,
            userTokenSecret,
            userName: profile.name,
            userId: profile.id,
          } as {
            userToken: string;
            userTokenSecret: string;
            userName: string;
            userId: string;
          });

          return done(null, profile);
        }
      )
    );
  }
}
