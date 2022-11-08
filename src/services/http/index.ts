import { GenericService } from '../../util/svc';
import express, { Express, json, NextFunction, Request, Response } from 'express';
import 'express-async-errors';
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
import { logAfter, logBefore } from './middlewares/log';

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

  preview = async (req: Request, res: Response) => {
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
  };

  ipfsUpload = async (req: Request, res: Response) => {
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
  };

  initControllers() {
    ['events', 'interep', 'merkle', 'posts', 'tags', 'twitter', 'users', 'zkChat'].forEach(
      controller => {
        this.app.use(this.get(`${controller}Controller`, 'router'));
      }
    );
  }

  addRoutes() {
    this.initControllers();
    this.app.use(staticRouter);
    this.app.get('/healthcheck', async (req, res) => res.send(makeResponse('ok')));
    this.app.get('/preview', this.preview);
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
      this.ipfsUpload
    );
  }

  async start() {
    const httpServer = http.createServer(this.app);
    const sessionStore = new SequelizeStore({
      db: sequelize,
    });

    this.app.set('trust proxy', 1);

    this.app.use(cors(corsOptions));
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

    this.app.use(logBefore, json());
    this.addRoutes();
    this.app.use(logAfter);

    this.httpServer = httpServer.listen(config.port);
    logger.info(`api server listening at ${config.port}...`);
  }
}
