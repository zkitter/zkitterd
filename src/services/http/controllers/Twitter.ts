import { calculateReputation, OAuthProvider } from '@interep/reputation';
import { Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import queryString from 'querystring';

import { verifySignatureP256 } from '@util/crypto';
import {
  accessToken,
  getBotometerScore,
  getUser,
  requestToken,
  showStatus,
  TW_AUTH_URL,
  updateStatus,
  verifyCredential,
} from '@util/twitter';
import { JWT_SECRET } from '../constants';
import { makeResponse } from '../utils';
import { Controller } from './interface';

export class TwitterController extends Controller {
  constructor() {
    super();
    this.addRoutes();
  }

  addRoutes = () => {
    this._router.use(
      '/twitter',
      Router()
        .get('', this.requestToken)
        .get('/callback', this.callback)
        .get('/check', this.check)
        .get('/session', this.session)
        .get('/status', this.status)
        .get('/user/:username', this.user)
        .post('/update', this.update)
    );
    this._router.get('/oauth/reset', this.reset);
  };

  requestToken = async (req: Request, res: Response) => {
    const text = await requestToken();
    const { oauth_token: token, oauth_token_secret: tokenSecret } = queryString.parse(text);

    // @ts-expect-error
    req.session.tokenSecret = tokenSecret;
    // @ts-expect-error
    req.session.redirectUrl = req.query.redirectUrl;
    res.send(makeResponse(`${TW_AUTH_URL}?${queryString.stringify({ oauth_token: token })}`));
  };

  callback = async (req: Request, res: Response) => {
    const { oauth_token: token, oauth_verifier: verifier } = req.query;
    // @ts-expect-error
    const tokenSecret = req.session.tokenSecret;
    // @ts-expect-error
    delete req.session.tokenSecret;

    const text = await accessToken(token as string, verifier as string, tokenSecret);
    const {
      oauth_token: userToken,
      oauth_token_secret: userTokenSecret,
      screen_name: userName,
      user_id: userId,
    } = queryString.parse(text);

    if (!userToken || !userTokenSecret || !userName || !userId) {
      throw new Error('invalid oauth');
    }

    const twitterAuthDB = await this.call('db', 'getTwitterAuth');
    await twitterAuthDB.updateUserToken({
      userId,
      userName,
      userToken,
      userTokenSecret,
    } as {
      userToken: string;
      userTokenSecret: string;
      userName: string;
      userId: string;
    });

    // @ts-expect-error
    req.session.twitterToken = jwt.sign({ userToken }, JWT_SECRET);

    // @ts-expect-error
    const redirectUrl = req.session.redirectUrl;
    // @ts-expect-error
    delete req.session.redirectUrl;
    res.redirect(redirectUrl);
  };

  check = async (req: Request, res: Response) => {
    const { username } = req.query;
    const twitterAuthDB = await this.call('db', 'getTwitterAuth');
    const user = await twitterAuthDB.findUserByUsername(username as string);
    res.send(makeResponse(user));
  };

  session = async (req: Request, res: Response) => {
    // @ts-expect-error
    const { twitterToken } = req.session;
    const signature = req.header('X-SIGNED-ADDRESS');
    const twitterAuthDB = await this.call('db', 'getTwitterAuth');
    const userDB = await this.call('db', 'getUsers');

    let auth;

    if (signature) {
      const [sig, address] = signature.split('.');
      const user = await userDB.findOneByName(address);

      if (user?.pubkey) {
        if (verifySignatureP256(user.pubkey, address, sig)) {
          const sigAuth = await twitterAuthDB.findUserByAccount(address);

          if (sigAuth) {
            auth = sigAuth;

            // @ts-expect-error
            req.session.twitterToken = jwt.sign(
              {
                userToken: auth.user_token,
              },
              JWT_SECRET
            );
          }
        }
      }
    }

    if (!auth) {
      const jwtData: any = await jwt.verify(twitterToken, JWT_SECRET);
      auth = await twitterAuthDB.findUserByToken(jwtData?.userToken);
    }

    const json = await verifyCredential(auth.user_token, auth.user_token_secret);

    const { followers_count, profile_image_url, profile_image_url_https, screen_name, verified } =
      json;

    const botometerOverallScore = await getBotometerScore(screen_name);

    const reputation = calculateReputation(OAuthProvider.TWITTER, {
      botometerOverallScore,
      followers: followers_count,
      verifiedProfile: verified,
    });

    res.send(
      makeResponse({
        followers: followers_count,
        profileImageUrl: profile_image_url,
        profileImageUrlHttps: profile_image_url_https,
        reputation,
        screenName: screen_name,
        user_id: auth.user_id,
        user_token: auth.user_token,
        user_token_secret: auth.user_token_secret,
        username: auth.username,
        verifiedProfile: verified,
      })
    );
  };

  reset = async (req: Request, res: Response) => {
    // @ts-expect-error
    if (req.session.twitterToken) delete req.session.twitterToken;
    res.send(makeResponse('ok'));
  };

  status = async (req: Request, res: Response) => {
    const { id } = req.query;
    const status = await showStatus(id as string);
    res.send(makeResponse(status));
  };

  user = async (req: Request, res: Response) => {
    const { username } = req.params;
    const user = await getUser(username);
    res.send(makeResponse(user));
  };

  update = async (req: Request, res: Response) => {
    // @ts-expect-error
    const { twitterToken } = req.session;
    const { in_reply_to_status_id, status } = req.body;
    const jwtData: any = await jwt.verify(twitterToken, JWT_SECRET);
    const twitterAuthDB = await this.call('db', 'getTwitterAuth');
    const auth = await twitterAuthDB.findUserByToken(jwtData?.userToken);
    const json = await updateStatus(
      status,
      in_reply_to_status_id,
      auth.user_token,
      auth.user_token_secret
    );
    res.send(makeResponse(`https://twitter.com/${auth.username}/status/${json.id_str}`));
  };
}
