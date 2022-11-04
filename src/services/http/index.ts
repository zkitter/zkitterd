import { GenericService } from '../../util/svc';
import express, { Express, NextFunction, Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import http from 'http';
import config from '../../util/config';
import logger from '../../util/logger';
import path from 'path';
import { getLinkPreview } from 'link-preview-js';
import queryString from 'querystring';
import session from 'express-session';
import jwt from 'jsonwebtoken';
import { QueryTypes } from 'sequelize';
import { calculateReputation, OAuthProvider } from '@interep/reputation';
import {
  accessToken,
  createHeader,
  getBotometerScore,
  getUser,
  requestToken,
  showStatus,
  TW_AUTH_URL,
  updateStatus,
  verifyCredential,
} from '../../util/twitter';
import { verifySignatureP256 } from '../../util/crypto';
import fs from 'fs';
import { getFilesFromPath } from 'web3.storage';
import { UploadModel } from '../../models/uploads';
import { genExternalNullifier, Semaphore, SemaphoreFullProof } from '@zk-kit/protocols';
import vKey from '../../../static/verification_key.json';
import { sequelize } from '../../util/sequelize';
import crypto from 'crypto';
import { addConnection, addTopic, keepAlive, removeConnection } from '../../util/sse';
import { makeResponse, upload } from './utils';
import { corsOptions, JWT_SECRET, maxFileSize, maxPerUserSize } from './constants';

const jsonParser = bodyParser.json();
const SequelizeStore = require('connect-session-sequelize')(session.Store);

export default class HttpService extends GenericService {
  app: Express;
  httpServer: any;

  constructor() {
    super();
    this.app = express();
  }

  verifyAuth =
    (
      getExternalNullifer: (req: Request) => string | Promise<string>,
      getSignal: (req: Request) => string | Promise<string>,
      onError?: (req: Request) => void | Promise<void>
    ) =>
    async (req: Request, res: Response, next: NextFunction) => {
      const signature = req.header('X-SIGNED-ADDRESS');
      const semaphoreProof = req.header('X-SEMAPHORE-PROOF');
      const rlnProof = req.header('X-RLN-PROOF');
      const userDB = await this.call('db', 'getUsers');

      if (signature) {
        const params = signature.split('.');
        const user = await userDB.findOneByName(params[1]);
        if (!user || !verifySignatureP256(user.pubkey, params[1], params[0])) {
          res.status(403).send(makeResponse('user must be authenticated', true));
          if (onError) onError(req);
          return;
        }
        // @ts-ignore
        req.username = params[1];
      } else if (semaphoreProof) {
        const { proof, publicSignals } = JSON.parse(semaphoreProof) as SemaphoreFullProof;
        const externalNullifier = genExternalNullifier(await getExternalNullifer(req));
        const signalHash = Semaphore.genSignalHash(await getSignal(req));
        const matchNullifier =
          BigInt(externalNullifier).toString() === publicSignals.externalNullifier;
        const matchSignal = signalHash.toString() === publicSignals.signalHash;
        const hashData = await this.call(
          'interrep',
          'getBatchFromRootHash',
          publicSignals.merkleRoot
        );
        const verified = await Semaphore.verifyProof(vKey as any, {
          proof,
          publicSignals,
        });

        if (!matchNullifier || !matchSignal || !verified || !hashData) {
          res.status(403).send(makeResponse('invalid semaphore proof', true));
          if (onError) onError(req);
          return;
        }
      } else if (rlnProof) {
        const { proof, publicSignals, x_share, epoch } = JSON.parse(rlnProof);
        const verified = await this.call('zkchat', 'verifyRLNProof', {
          proof,
          publicSignals,
          x_share: x_share,
          epoch: epoch,
        });
        const share = {
          nullifier: publicSignals.internalNullifier,
          epoch: publicSignals.epoch,
          y_share: publicSignals.yShare,
          x_share: x_share,
        };

        const { isSpam, isDuplicate } = await this.call('zkchat', 'checkShare', share);

        const group = await this.call(
          'merkle',
          'getGroupByRoot',
          '0x' + BigInt(publicSignals.merkleRoot).toString(16)
        );

        if (isSpam || isDuplicate || !verified || !group) {
          res.status(403).send(makeResponse('invalid semaphore proof', true));
          if (onError) onError(req);
          return;
        }
      }

      next();
    };

  wrapHandler(handler: (req: Request, res: Response) => Promise<any>) {
    return async (req: Request, res: Response) => {
      logger.info('received request', {
        url: req.url,
      });

      try {
        await handler(req, res);
        logger.info('handled request', {
          url: req.url,
        });
      } catch (e) {
        console.log(e);
        logger.info('error handling request', {
          message: e.message,
          url: req.url,
        });

        res.status(500).send({
          payload: e.message,
          error: true,
        });
      }
    };
  }

  handleGetProofs = async (req: Request, res: Response) => {
    const { idCommitment } = req.params;
    const { group = '', proofType = '' } = req.query;
    const proof = await this.call('merkle', 'findProof', idCommitment, group, proofType);

    res.send(
      makeResponse({
        data: proof,
      })
    );
  };

  handleGetMembers = async (req: Request, res: Response) => {
    const { group } = req.params;
    const leaves = await this.call('merkle', 'getAllLeaves', group);
    res.send(makeResponse(leaves));
  };

  handleGetGroupsByAddress = async (req: Request, res: Response) => {
    const { address } = req.params;
    const values = await sequelize.query(
      // prettier-ignore
      `
          SELECT u.name             as address,
                 name.value         as name,
                 idcommitment.value as idcommitment
          FROM users u
                   LEFT JOIN profiles name ON name."messageId" = (SELECT "messageId"
                                                                  FROM profiles
                                                                  WHERE creator = u.name
                                                                    AND subtype = 'NAME'
                                                                  ORDER BY "createdAt" DESC LIMIT 1)
              JOIN profiles idcommitment
          ON idcommitment."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'CUSTOM' AND key ='id_commitment' ORDER BY "createdAt" DESC LIMIT 1)
              JOIN connections invite ON invite.subtype = 'MEMBER_INVITE' AND invite.creator = u.name AND invite.name = :member_address
              JOIN connections accept ON accept.subtype = 'MEMBER_ACCEPT' AND accept.creator = :member_address AND accept.name = u.name
      `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          member_address: address,
        },
      }
    );
    res.send(makeResponse(values));
  };

  handleGetEvents = async (req: Request, res: Response) => {
    const headers = {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
    };

    res.writeHead(200, headers);

    const clientId = crypto.randomBytes(16).toString('hex');

    addConnection(clientId, res);
  };

  initControllers() {
    ['users', 'posts', 'tags', 'zkChat', 'events'].forEach(controller => {
      this.app.use('/v1', this.get(`${controller}Controller`, 'router'));
    });
  }

  addRoutes() {
    this.initControllers();
    this.app.get(
      '/healthcheck',
      this.wrapHandler(async (req, res) => {
        res.send(makeResponse('ok'));
      })
    );

    this.app.get('/v1/proofs/:idCommitment', this.wrapHandler(this.handleGetProofs));
    this.app.get('/v1/group_members/:group', this.wrapHandler(this.handleGetMembers));
    this.app.get('/v1/:address/groups', this.wrapHandler(this.handleGetGroupsByAddress));

    this.app.post(
      '/interrep/groups/:provider/:name/:identityCommitment',
      jsonParser,
      this.wrapHandler(async (req, res) => {
        const identityCommitment = req.params.identityCommitment;
        const provider = req.params.provider;
        const name = req.params.name;

        // @ts-ignore
        const { twitterToken } = req.session;
        const jwtData: any = await jwt.verify(twitterToken, JWT_SECRET);
        const twitterAuthDB = await this.call('db', 'getTwitterAuth');
        const auth = await twitterAuthDB.findUserByToken(jwtData?.userToken);

        const headers = createHeader(
          {
            url: `https://api.twitter.com/1.1/account/verify_credentials.json`,
            method: 'GET',
          },
          auth.user_token,
          auth.user_token_secret
        );

        // @ts-ignore
        const resp = await fetch(
          `${config.interrepAPI}/api/v1/groups/${provider}/${name}/${identityCommitment}`,
          {
            method: 'POST',
            headers: headers,
          }
        );

        if (resp.status !== 201) {
          res.status(resp.status).send(makeResponse(resp.statusText, true));
          return;
        }

        const json = await resp.json();

        res.send(makeResponse(json));
      })
    );

    this.app.get(
      '/dev/interep/:identityCommitment',
      jsonParser,
      this.wrapHandler(async (req, res) => {
        const identityCommitment = req.params.identityCommitment;
        // @ts-ignore
        const resp = await fetch(`${config.interrepAPI}/api/v1/groups`);
        const { data: groups } = await resp.json();
        for (const group of groups) {
          // @ts-ignore
          const existResp = await fetch(
            `${config.interrepAPI}/api/v1/groups/${group.provider}/${group.name}/${identityCommitment}`
          );
          const { data: exist } = await existResp.json();

          if (exist) {
            // @ts-ignore
            const proofResp = await fetch(
              `${config.interrepAPI}/api/v1/groups/${group.provider}/${group.name}/${identityCommitment}/proof`
            );
            const json = await proofResp.json();
            res.send(
              makeResponse({
                ...json,
                provider: group.provider,
                name: group.name,
              })
            );
            return;
          }
        }

        res.send(makeResponse(null));
      })
    );

    this.app.get(
      '/interrep/:identityCommitment',
      jsonParser,
      this.wrapHandler(async (req, res) => {
        const identityCommitment = req.params.identityCommitment;
        const semaphoreDB = await this.call('db', 'getSemaphore');
        // const exist = await semaphoreDB.findOneByCommitment(identityCommitment);

        // if (!exist || exist?.updatedAt.getTime() + 15 * 60 * 1000 > Date.now()) {
        //     await this.call('interrep', 'scanIDCommitment', identityCommitment);
        // }

        const sem = await semaphoreDB.findAllByCommitment(identityCommitment);
        const [group] = sem;

        if (!group) {
          res.status(404).send(makeResponse('not found', true));
          return;
        }
        // @ts-ignore
        const resp = await fetch(
          `${config.interrepAPI}/api/v1/groups/${group.provider}/${group.name}/${identityCommitment}/proof`
        );
        const json = await resp.json();
        res.send(
          makeResponse({
            ...json,
            provider: group.provider,
            name: group.name,
          })
        );
      })
    );

    this.app.get(
      '/preview',
      this.wrapHandler(async (req, res) => {
        const linkDB = await this.call('db', 'getLinkPreview');

        if (typeof req.query.link !== 'string') {
          res.status(400).send(makeResponse(`link must be present in query string.`, true));
          return;
        }

        const url = decodeURI(req.query.link);

        const model = await linkDB.read(url);

        if (model && model.updatedAt.getTime() + 1000 * 60 * 60 * 24 > new Date().getTime()) {
          res.send(makeResponse(model));
          return;
        }

        const preview: any = await getLinkPreview(url);
        const data = {
          link: preview.url,
          mediaType: preview.mediaType || '',
          contentType: preview.contentType || '',
          title: preview.title || '',
          description: preview.description || '',
          image: preview.images ? preview.images[0] : '',
          favicon: preview.favicon || '',
        };

        await linkDB.update(data);
        res.send(makeResponse(data));
      })
    );

    this.app.get(
      '/twitter',
      this.wrapHandler(async (req, res) => {
        const text = await requestToken();
        const { oauth_token: token, oauth_token_secret: tokenSecret } = queryString.parse(text);

        // @ts-ignore
        req.session.tokenSecret = tokenSecret;
        // @ts-ignore
        req.session.redirectUrl = req.query.redirectUrl;
        res.send(makeResponse(`${TW_AUTH_URL}?${queryString.stringify({ oauth_token: token })}`));
      })
    );

    this.app.get(
      '/twitter/callback',
      this.wrapHandler(async (req, res) => {
        // @ts-ignore
        const { oauth_token: token, oauth_verifier: verifier } = req.query;
        // @ts-ignore
        const tokenSecret = req.session.tokenSecret;
        // @ts-ignore
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
          userToken,
          userTokenSecret,
          userName,
          userId,
        } as {
          userToken: string;
          userTokenSecret: string;
          userName: string;
          userId: string;
        });

        // @ts-ignore
        req.session.twitterToken = jwt.sign({ userToken }, JWT_SECRET);

        // @ts-ignore
        const redirectUrl = req.session.redirectUrl;
        // @ts-ignore
        delete req.session.redirectUrl;
        res.redirect(redirectUrl);
      })
    );

    this.app.get(
      '/twitter/session',
      this.wrapHandler(async (req, res) => {
        // @ts-ignore
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

                // @ts-ignore
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

        const {
          followers_count,
          verified,
          profile_image_url,
          profile_image_url_https,
          screen_name,
        } = json;

        const botometerResult = await getBotometerScore(screen_name);

        const reputation = calculateReputation(OAuthProvider.TWITTER, {
          followers: followers_count,
          verifiedProfile: verified,
          botometerOverallScore: botometerResult?.display_scores?.universal?.overall,
        });

        res.send(
          makeResponse({
            user_id: auth.user_id,
            user_token: auth.user_token,
            user_token_secret: auth.user_token_secret,
            username: auth.username,
            followers: followers_count,
            verifiedProfile: verified,
            profileImageUrl: profile_image_url,
            profileImageUrlHttps: profile_image_url_https,
            screenName: screen_name,
            reputation,
          })
        );
      })
    );

    this.app.get(
      '/twitter/check',
      this.wrapHandler(async (req, res) => {
        const { username } = req.query;
        const twitterAuthDB = await this.call('db', 'getTwitterAuth');
        const user = await twitterAuthDB.findUserByUsername(username as string);
        res.send(makeResponse(user));
      })
    );

    this.app.get(
      '/twitter/user/:username',
      this.wrapHandler(async (req, res) => {
        const { username } = req.params;
        const user = await getUser(username);
        res.send(makeResponse(user));
      })
    );

    this.app.post(
      '/twitter/update',
      jsonParser,
      this.wrapHandler(async (req, res) => {
        // @ts-ignore
        const { twitterToken } = req.session;
        const { status, in_reply_to_status_id } = req.body;
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
      })
    );

    this.app.get(
      '/twitter/status',
      this.wrapHandler(async (req, res) => {
        // @ts-ignore
        const { id } = req.query;
        const status = await showStatus(id as string);
        res.send(makeResponse(status));
      })
    );

    this.app.get(
      '/oauth/reset',
      this.wrapHandler(async (req, res) => {
        // @ts-ignore
        if (req.session.twitterToken) delete req.session.twitterToken;
        res.send(makeResponse('ok'));
      })
    );

    this.app.post(
      '/ipfs/upload',
      upload.any(),
      this.verifyAuth(
        async () => 'FILE_UPLOAD',
        // @ts-ignore
        async req => req.files[0].originalname.slice(0, 16),
        req => {
          // @ts-ignore
          const filepath = path.join(process.cwd(), req.files[0].path);
          fs.unlinkSync(filepath);
        }
      ),
      this.wrapHandler(async (req, res) => {
        if (!req.files) throw new Error('file missing from formdata');

        // @ts-ignore
        const username = req.username;

        // @ts-ignore
        const { path: relPath, filename, size, mimetype } = req.files[0];
        const uploadDB = await this.call('db', 'getUploads');
        const filepath = path.join(process.cwd(), relPath);

        if (size > maxFileSize) {
          fs.unlinkSync(filepath);
          throw new Error('file must be less than 5MB');
        }

        if (username) {
          const existingSize = await uploadDB.getTotalUploadByUser(username);
          if (existingSize + size > maxPerUserSize) {
            fs.unlinkSync(filepath);
            throw new Error('account is out of space');
          }
        }

        const files = await getFilesFromPath(filepath);

        const cid = await this.call('ipfs', 'store', files);
        fs.unlinkSync(filepath);

        if (username) {
          const uploadData: UploadModel = {
            cid,
            mimetype,
            size,
            filename,
            username: username,
          };
          await uploadDB.addUploadData(uploadData);
        }

        res.send(
          makeResponse({
            cid,
            filename,
            url: `https://${cid}.ipfs.dweb.link/${filename}`,
          })
        );
      })
    );
  }

  async start() {
    const httpServer = http.createServer(this.app);

    this.app.set('trust proxy', 1);
    this.app.use(cors(corsOptions));

    const sessionStore = new SequelizeStore({
      db: sequelize,
    });

    this.app.use(
      session({
        proxy: true,
        secret: 'autistic cat',
        resave: false,
        saveUninitialized: false,
        store: sessionStore,
        cookie: {
          secure: false,
          maxAge: 30 * 24 * 60 * 60 * 1000,
        },
      })
    );

    sessionStore.sync();

    this.app.use(
      '/dev/semaphore_wasm',
      express.static(path.join(process.cwd(), 'static', 'semaphore.wasm'))
    );
    this.app.use(
      '/dev/semaphore_final_zkey',
      express.static(path.join(process.cwd(), 'static', 'semaphore_final.zkey'))
    );
    this.app.use(
      '/dev/semaphore_vkey',
      express.static(path.join(process.cwd(), 'static', 'verification_key.json'))
    );

    this.app.use(
      '/circuits/semaphore/wasm',
      express.static(path.join(process.cwd(), 'static', 'semaphore', 'semaphore.wasm'))
    );
    this.app.use(
      '/circuits/semaphore/zkey',
      express.static(path.join(process.cwd(), 'static', 'semaphore', 'semaphore_final.zkey'))
    );
    this.app.use(
      '/circuits/semaphore/vkey',
      express.static(path.join(process.cwd(), 'static', 'semaphore', 'verification_key.json'))
    );
    this.app.use(
      '/circuits/rln/wasm',
      express.static(path.join(process.cwd(), 'static', 'rln', 'rln.wasm'))
    );
    this.app.use(
      '/circuits/rln/zkey',
      express.static(path.join(process.cwd(), 'static', 'rln', 'rln_final.zkey'))
    );
    this.app.use(
      '/circuits/rln/vkey',
      express.static(path.join(process.cwd(), 'static', 'rln', 'verification_key.json'))
    );
    this.addRoutes();

    this.httpServer = httpServer.listen(config.port);
    logger.info(`api server listening at ${config.port}...`);
  }
}
