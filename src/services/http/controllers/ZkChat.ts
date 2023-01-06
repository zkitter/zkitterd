import { Request, Response, Router } from 'express';
import { QueryTypes } from 'sequelize';

import merkleRoot from '@models/merkle_root';
import { verifySignatureP256 } from '@util/crypto';
import { sequelize } from '@util/sequelize';
import { publishTopic, SSEType } from '@util/sse';

import { makeResponse } from '../utils';
import { Controller } from './interface';

export class ZkChatController extends Controller {
  merkleRoot?: ReturnType<typeof merkleRoot>;
  prefix = '/v1';

  constructor() {
    super();
    this.merkleRoot = merkleRoot(sequelize);
    this.addRoutes();
  }

  addRoutes = () => {
    this._router.use(
      '/zkchat',
      Router()
        .get('/users', this.getUsers)
        .post('/chat-messages', this.postMessage)
        .get('/chat-messages/dm/:sender/:receiver', this.getDirectMessage)
        .get('/chat-messages/dm/:sender/:receiver/unread', this.getUnreadCountDM)
        .get('/chats/dm/:pubkey', this.getDirectChats)
        .get('/chats/search/:query?', this.searchChats)
    );
  };

  getUsers = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const users = await this.call('zkchat', 'getAllUsers', offset, limit);
    res.send(makeResponse(users));
  };

  postMessage = async (req: Request, res: Response) => {
    const { ciphertext, messageId, receiver, rln, semaphore, sender, timestamp, type } = req.body;
    const signature = req.header('X-SIGNED-ADDRESS');
    const userDB = await this.call('db', 'getUsers');

    if (!sender.address && !sender.hash && !sender.ecdh) throw new Error('invalid sender');
    if (!receiver.address && !receiver.ecdh) throw new Error('invalid receiver');

    if (rln) {
      if (!sender.hash) throw new Error('invalid request object');

      const isEpochCurrent = await this.call('zkchat', 'isEpochCurrent', rln.epoch);
      const verified = await this.call('zkchat', 'verifyRLNProof', rln);
      const root = '0x' + BigInt(rln.publicSignals.merkleRoot).toString(16);
      const group = await this.call('merkle', 'getGroupByRoot', root);

      if (!isEpochCurrent) throw new Error('outdated message');
      if (!verified) throw new Error('invalid rln proof');
      if (!group) throw new Error('invalid merkle root');

      rln.group_id = group;

      const share = {
        epoch: rln.publicSignals.epoch,
        nullifier: rln.publicSignals.internalNullifier,
        x_share: rln.x_share,
        y_share: rln.publicSignals.yShare,
      };

      const { isDuplicate, isSpam } = await this.call('zkchat', 'checkShare', share);

      if (isDuplicate) {
        throw new Error('duplicate message');
      }

      if (isSpam) {
        res.status(429).send('too many requests');
        return;
      }

      await this.call('zkchat', 'insertShare', share);
      await this.merkleRoot?.addRoot(root, group);
    } else if (semaphore) {
      const verified = await this.call('zkchat', 'verifySemaphoreProof', semaphore);
      const root = '0x' + BigInt(semaphore.publicSignals.merkleRoot).toString(16);
      const group = await this.call('merkle', 'getGroupByRoot', root);
      if (!verified) throw new Error('invalid proof');
      if (!group) throw new Error('invalid merkle root');
      await this.merkleRoot?.addRoot(root, group);
    } else if (signature) {
      const [sig, address] = signature.split('.');
      const user = await userDB.findOneByName(address);

      if (user?.pubkey) {
        if (!verifySignatureP256(user.pubkey, address, sig)) {
          res.status(403).send(makeResponse('unauthorized', true));
          return;
        }
      }
    } else {
      res.status(403).send(makeResponse('unauthorized', true));
      return;
    }

    const data = await this.call('zkchat', 'addChatMessage', {
      ciphertext,
      messageId,
      receiver,
      rln,
      sender,
      timestamp: new Date(timestamp),
      type,
    });

    // await ?
    publishTopic(`ecdh:${data.sender_pubkey}`, {
      message: data,
      type: SSEType.NEW_CHAT_MESSAGE,
    });
    // await ?
    publishTopic(`ecdh:${data.receiver_pubkey}`, {
      message: data,
      type: SSEType.NEW_CHAT_MESSAGE,
    });
    res.send(makeResponse(data));
  };

  getDirectMessage = async (req: Request, res: Response) => {
    const { receiver, sender } = req.params;
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const data = await this.call('zkchat', 'getDirectMessages', sender, receiver, offset, limit);
    res.send(makeResponse(data));
  };

  getDirectChats = async (req: Request, res: Response) => {
    const { pubkey } = req.params;

    const values = await sequelize.query(
      // prettier-ignore
      `
          SELECT distinct zkc.receiver_pubkey as pubkey, zkc.receiver_address as address, null as group_id
          FROM zkchat_chats zkc
          WHERE zkc.receiver_pubkey IN (SELECT distinct receiver_pubkey FROM zkchat_chats WHERE sender_pubkey = :pubkey)
          UNION
          SELECT distinct zkc.sender_pubkey as pubkey, zkc.sender_address as address, mr.group_id
          FROM zkchat_chats zkc
                   LEFT JOIN merkle_roots mr on mr.root_hash = zkc.rln_root
          WHERE zkc.sender_pubkey IN (SELECT distinct sender_pubkey FROM zkchat_chats WHERE receiver_pubkey = :pubkey);
      `,
      {
        replacements: {
          pubkey,
        },
        type: QueryTypes.SELECT,
      }
    );

    const data = values.map((val: any) => ({
      group: val.group_id,
      receiver: val.address,
      receiverECDH: val.pubkey,
      senderECDH: pubkey,
      type: 'DIRECT',
    }));

    res.send(makeResponse(data));
  };

  searchChats = async (req: Request, res: Response) => {
    const { query } = req.params;
    const { sender } = req.query;
    const data = await this.call('zkchat', 'searchChats', query || '', sender);
    res.send(makeResponse(data));
  };

  getUnreadCountDM = async (req: Request, res: Response) => {
    const { receiver, sender } = req.params;
    const lastReadDB = await this.call('db', 'getLastRead');
    const result = await lastReadDB.getLastRead(receiver, sender);
    const lastRead = result?.lastread || 0;
    const data = await this.call('zkchat', 'getUnreadCountDM', sender, receiver, lastRead);
    res.send(makeResponse(data));
  };
}
