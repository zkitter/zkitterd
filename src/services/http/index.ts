import { GenericService } from '../../util/svc';
import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import config from '../../util/config';
import logger from '../../util/logger';
import path from 'path';
import { getLinkPreview } from 'link-preview-js';
import session from 'express-session';
import { QueryTypes } from 'sequelize';

import { verifySignatureP256 } from '../../util/crypto';
import fs from 'fs';
import { getFilesFromPath } from 'web3.storage';
import { UploadModel } from '../../models/uploads';
import { genExternalNullifier, Semaphore, SemaphoreFullProof } from '@zk-kit/protocols';
import vKey from '../../../static/verification_key.json';
import { sequelize } from '../../util/sequelize';
import crypto from 'crypto';
import { addConnection } from '../../util/sse';
import { makeResponse, upload } from './utils';
import { corsOptions, maxFileSize, maxPerUserSize } from './constants';

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
    ['users', 'posts', 'tags', 'zkChat', 'events', 'interep', 'twitter'].forEach(controller => {
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
