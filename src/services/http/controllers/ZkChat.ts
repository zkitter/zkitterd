import { Request, Response, Router } from 'express';
import { makeResponse } from '../utils';
import { Controller } from './interface';

export class ZkChatController extends Controller {
  prefix = '/v1';

  constructor() {
    super();
    this.addRoutes();
  }

  addRoutes = () => {
    this._router.use(
      '/zkchat',
      Router()
        // .get('/users', this.getUsers)
        // .post('/chat-messages', this.postMessage)
        // .get('/chat-messages/dm/:sender/:receiver', this.getDirectMessage)
        // .get('/chat-messages/dm/:sender/:receiver/unread', this.getUnreadCountDM)
        // .get('/chats/dm/:pubkey', this.getDirectChats)
        .get('/chats/search/:query?', this.searchChats)
    );
  };

  // getUsers = async (req: Request, res: Response) => {
  //   const limit = req.query.limit && Number(req.query.limit);
  //   const offset = req.query.offset && Number(req.query.offset);
  //   const users = await this.call('zkchat', 'getAllUsers', offset, limit);
  //   res.send(makeResponse(users));
  // };

  // postMessage = async (req: Request, res: Response) => {
  //   const { ciphertext, messageId, receiver, rln, semaphore, sender, timestamp, type } = req.body;
  //   const signature = req.header('X-SIGNED-ADDRESS');
  //   const userDB = await this.call('db', 'getUsers');
  //
  //   if (!sender.address && !sender.hash && !sender.ecdh) throw new Error('invalid sender');
  //   if (!receiver.address && !receiver.ecdh) throw new Error('invalid receiver');
  //
  //   if (rln) {
  //     if (!sender.hash) throw new Error('invalid request object');
  //
  //     const isEpochCurrent = await this.call('zkchat', 'isEpochCurrent', rln.epoch);
  //     const verified = await this.call('zkchat', 'verifyRLNProof', rln);
  //     const root = '0x' + BigInt(rln.publicSignals.merkleRoot).toString(16);
  //     const group = await this.call('merkle', 'getGroupByRoot', root);
  //
  //     if (!isEpochCurrent) throw new Error('outdated message');
  //     if (!verified) throw new Error('invalid rln proof');
  //     if (!group) throw new Error('invalid merkle root');
  //
  //     rln.group_id = group;
  //
  //     const share = {
  //       epoch: rln.publicSignals.epoch,
  //       nullifier: rln.publicSignals.internalNullifier,
  //       x_share: rln.x_share,
  //       y_share: rln.publicSignals.yShare,
  //     };
  //
  //     const { isDuplicate, isSpam } = await this.call('zkchat', 'checkShare', share);
  //
  //     if (isDuplicate) {
  //       throw new Error('duplicate message');
  //     }
  //
  //     if (isSpam) {
  //       res.status(429).send('too many requests');
  //       return;
  //     }
  //
  //     await this.call('zkchat', 'insertShare', share);
  //     await this.merkleRoot?.addRoot(root, group);
  //   } else if (semaphore) {
  //     const verified = await this.call('zkchat', 'verifySemaphoreProof', semaphore);
  //     const root = '0x' + BigInt(semaphore.publicSignals.merkleRoot).toString(16);
  //     const group = await this.call('merkle', 'getGroupByRoot', root);
  //     if (!verified) throw new Error('invalid proof');
  //     if (!group) throw new Error('invalid merkle root');
  //     await this.merkleRoot?.addRoot(root, group);
  //   } else if (signature) {
  //     const [sig, address] = signature.split('.');
  //     const user = await userDB.findOneByName(address);
  //
  //     if (user?.pubkey) {
  //       if (!verifySignatureP256(user.pubkey, address, sig)) {
  //         res.status(403).send(makeResponse('unauthorized', true));
  //         return;
  //       }
  //     }
  //   } else {
  //     res.status(403).send(makeResponse('unauthorized', true));
  //     return;
  //   }
  //
  //   const data = await this.call('zkchat', 'addChatMessage', {
  //     ciphertext,
  //     messageId,
  //     receiver,
  //     rln,
  //     sender,
  //     timestamp: new Date(timestamp),
  //     type,
  //   });
  //
  //   // await ?
  //   publishTopic(`ecdh:${data.sender_pubkey}`, {
  //     message: data,
  //     type: SSEType.NEW_CHAT_MESSAGE,
  //   });
  //   // await ?
  //   publishTopic(`ecdh:${data.receiver_pubkey}`, {
  //     message: data,
  //     type: SSEType.NEW_CHAT_MESSAGE,
  //   });
  //   res.send(makeResponse(data));
  // };

  searchChats = async (req: Request, res: Response) => {
    const { query } = req.params;
    const { sender } = req.query || {};
    const data = await this.call('zkchat', 'searchChats', query || '', sender);
    res.send(makeResponse(data));
  };
}
