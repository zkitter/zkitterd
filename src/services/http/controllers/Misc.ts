import { genExternalNullifier, Semaphore, SemaphoreFullProof } from '@zk-kit/protocols';
import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import { getLinkPreview } from 'link-preview-js';
import path from 'path';
import { getFilesFromPath } from 'web3.storage';

import { UploadModel } from '@models/uploads';
import { verifySignatureP256 } from '@util/crypto';
import vKey from '#/verification_key.json';
import { MAX_FILE_SIZE, MAX_PER_USER_SIZE } from '../constants';
import { makeResponse, upload } from '../utils';
import { Controller } from './interface';

export class MiscController extends Controller {
  prefix = '/v1';

  constructor() {
    super();
    this.addRoutes();
  }

  addRoutes = () => {
    this._router
      .get('/healthcheck', this.healthcheck)
      .get('/preview', this.preview)
      .post(
        '/ipfs/upload',
        upload.any(),
        this.verifyAuth(
          async () => 'FILE_UPLOAD',
          // @ts-expect-error
          async req => req.files[0].originalname.slice(0, 16),
          req => {
            // @ts-expect-error
            const filepath = path.join(process.cwd(), req.files[0].path);
            fs.unlinkSync(filepath);
          }
        ),
        this.ipfsUpload
      )
      .post('/lastread/:reader/:context?', this.postLastRead);
  };

  healthcheck = async (req: Request, res: Response) => res.send(makeResponse('ok'));

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
      contentType: preview.contentType || '',
      description: preview.description || '',
      favicon: preview.favicon || '',
      image: preview.images ? preview.images[0] : '',
      link: preview.url,
      mediaType: preview.mediaType || '',
      title: preview.title || '',
    };

    await linkDB.update(data);
    res.send(makeResponse(data));
  };

  ipfsUpload = async (req: Request, res: Response) => {
    if (!req.files) throw new Error('file missing from formdata');

    // @ts-expect-error
    const username = req.username;

    // @ts-expect-error
    const { filename, mimetype, path: relPath, size } = req.files[0];
    const uploadDB = await this.call('db', 'getUploads');
    const filepath = path.join(process.cwd(), relPath);

    if (size > MAX_FILE_SIZE) {
      fs.unlinkSync(filepath);
      throw new Error('file must be less than 5MB');
    }

    if (username) {
      const existingSize = await uploadDB.getTotalUploadByUser(username);
      if (existingSize + size > MAX_PER_USER_SIZE) {
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
        filename,
        mimetype,
        size,
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
        // @ts-expect-error
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
        const { epoch, proof, publicSignals, x_share } = JSON.parse(rlnProof);
        const verified = await this.call('zkchat', 'verifyRLNProof', {
          epoch: epoch,
          proof,
          publicSignals,
          x_share: x_share,
        });
        const share = {
          epoch: publicSignals.epoch,
          nullifier: publicSignals.internalNullifier,
          x_share: x_share,
          y_share: publicSignals.yShare,
        };

        const { isDuplicate, isSpam } = await this.call('zkchat', 'checkShare', share);

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

  postLastRead = async (req: Request, res: Response) => {
    const reader = req.params.reader;
    const context = req.params.context;
    const { lastread } = req.body;
    const lastReadDB = await this.call('db', 'getLastRead');
    await lastReadDB.update({ context: context || '', lastread, reader });
    res.send(makeResponse('ok'));
  };
}
