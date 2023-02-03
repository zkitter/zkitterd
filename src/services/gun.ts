/* eslint-disable no-case-declarations */
import { Semaphore } from '@zk-kit/protocols';
import { Mutex } from 'async-mutex';
import express from 'express';
import Gun from 'gun';
import merkleRoot from '@models/merkle_root';

import { UserModel } from '@models/users';
import config from '@util/config';
import logger from '@util/logger';
import {
  Connection,
  ConnectionMessageSubType,
  Message,
  MessageType,
  Moderation,
  ModerationMessageSubType,
  parseMessageId,
  Post,
  PostMessageSubType,
  Profile,
  ProfileMessageSubType,
} from '@util/message';
import { HASHTAG_REGEX, MENTION_REGEX } from '@util/regex';
import { sequelize } from '@util/sequelize';
import { GenericService } from '@util/svc';
import { showStatus } from '@util/twitter';
import vKey from '#/verification_key.json';
import { IGunChainReference } from 'gun/types/chain';

const Graph = require('~/gun/graph.js');
const State = require('~/gun/state.js');
const Val = require('~/gun/val.js');

const getMutex = new Mutex();
const putMutex = new Mutex();
const insertMutex = new Mutex();

export default class GunService extends GenericService {
  gun?: IGunChainReference;
  merkleRoot?: ReturnType<typeof merkleRoot>;

  parseGunMessage = async (data: any, messageId: string, pubkey?: string) => {
    const { creator } = parseMessageId(messageId);

    let user: UserModel | null = null;

    if (creator) {
      const users = await this.call('db', 'getUsers');

      user = await users.findOneByPubkey(pubkey);

      if (!user) return;

      if (!['arbitrum'].includes(user.type)) return;

      if (creator !== user.name) return;
    }

    let payload;

    if (data === null) {
      return;
    }

    if (!data.type) return;

    const type = Message.getType(data.type);

    if (data.payload) {
      // @ts-expect-error
      payload = await this.gun.get(data.payload['#']);
    }

    switch (type) {
      case MessageType.Post:
        return new Post({
          createdAt: new Date(Number(data.createdAt)),
          creator: creator,
          payload: {
            attachment: payload.attachment,
            content: payload.content,
            reference: payload.reference,
            title: payload.title,
            topic: payload.topic,
          },
          subtype: Post.getSubtype(data.subtype),
          type: type,
        });
      case MessageType.Moderation:
        return new Moderation({
          createdAt: new Date(Number(data.createdAt)),
          creator: creator,
          payload: {
            reference: payload.reference,
          },
          subtype: Moderation.getSubtype(data.subtype),
          type: type,
        });
      case MessageType.Connection:
        return new Connection({
          createdAt: new Date(Number(data.createdAt)),
          creator: creator,
          payload: {
            name: payload.name,
          },
          subtype: Connection.getSubtype(data.subtype),
          type: type,
        });
      case MessageType.Profile:
        return new Profile({
          createdAt: new Date(Number(data.createdAt)),
          creator: creator,
          payload: {
            key: payload.key,
            value: payload.value,
          },
          subtype: Profile.getSubtype(data.subtype),
          type: type,
        });
    }
  };

  async deleteMessage(messageId: string) {
    const { creator, hash } = parseMessageId(messageId);
    const posts = await this.call('db', 'getPosts');
    const mods = await this.call('db', 'getModerations');
    const conns = await this.call('db', 'getConnections');
    const pfs = await this.call('db', 'getProfiles');
    const userMeta = await this.call('db', 'getUserMeta');
    const postMeta = await this.call('db', 'getMeta');
    const tagDB = await this.call('db', 'getTags');

    let msg;

    if ((msg = await conns.findOne(hash))) {
      switch (msg.subtype) {
        case 'FOLLOW':
          await userMeta.removeFollowing(msg.creator);
          await userMeta.removeFollower(msg.name);
          break;
        case 'BLOCK':
          await userMeta.removeBlocking(msg.creator);
          await userMeta.removeBlocked(msg.name);
          break;
      }

      await conns.remove(hash);
    } else if ((msg = await mods.findOne(hash))) {
      switch (msg.subtype) {
        case 'LIKE':
          await postMeta.removeLike(msg.reference);
          break;
      }
      await mods.remove(hash);
    } else if ((msg = await posts.findOne(hash))) {
      switch (msg.subtype) {
        case 'REPOST':
          await postMeta.removeRepost(msg.payload.reference);
          break;
        case 'M_REPLY':
        case 'REPLY':
          await postMeta.removeReply(msg.payload.reference);
          break;
        case 'M_POST':
        default:
          await userMeta.removePostingCount(creator);
          break;
      }

      const payload = msg.payload;

      const tags = payload.content?.match(HASHTAG_REGEX);
      if (tags) {
        for (const tagName of tags) {
          await tagDB.removeTagPost(tagName, messageId);
          await postMeta.removePost(tagName);
        }
      }

      const mentions = payload.content?.match(MENTION_REGEX);
      if (mentions) {
        for (const mention of mentions) {
          const addr = await this.call('ens', 'fetchAddressByName', mention.slice(1));
          await userMeta.removeMentionedCount(addr);
          await tagDB.removeTagPost('@' + addr, messageId);
        }
      }

      await posts.remove(hash);
    } else if (await pfs.findOne(hash)) {
      await pfs.remove(hash);
    }
  }

  async start() {
    this.merkleRoot = await merkleRoot(sequelize);
    const app = express();
    const server = app.listen(config.gunPort);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ctx = this;
    const gunPath = process.env.NODE_ENV === 'development' ? './dev_gun_data' : './gun_data';

    const gun = Gun({
      file: gunPath,
      peers: config.gunPeers,
      web: server,
    });

    // @ts-expect-error
    gun.on('put', async function (msg: any) {
      return putMutex.runExclusive(async () => {
        // @ts-expect-error
        this.to.next(msg);

        try {
          const put = msg.put;
          const soul = put['#'];
          const field = put['.'];
          const state = put['>'];
          const value = put[':'];

          const [raw, , username] = soul.split('/');
          const recordDB = await ctx.call('db', 'getRecords');
          const userDB = await ctx.call('db', 'getUsers');

          if (raw !== 'message') {
            const pubKey = raw.slice(1);

            // if (key && key !== 'message') {
            //     throw new Error(`invalid data key ${key}`);
            // }

            const user = await userDB.findOneByPubkey(pubKey);

            if (!user) {
              throw new Error(`cannot find user with pubkey ${pubKey}`);
            }

            if (username && ![username].includes(user.name)) {
              throw new Error(`${user.name} does not match ${username}`);
            }
          }

          let relation;

          if (value && value['#']) {
            relation = value['#'];
          }

          await recordDB.updateOrCreateRecord({
            field,
            relation,
            soul,
            state,
            value: relation ? null : value,
          });

          logger.debug('handled PUT', {
            field,
            origin: 'gun',
            soul,
          });

          // Send ack back
          // @ts-expect-error
          gun.on('in', {
            '@': msg['@'],
            ok: 0,
          });
        } catch (e) {
          logger.error('error processing PUT', {
            error: e.message,
            origin: 'gun',
            parent: e.parent,
            stack: e.stack,
          });
        }
      });
    });

    // @ts-expect-error
    gun.on('get', async function (msg: any) {
      return getMutex.runExclusive(async () => {
        // @ts-expect-error
        this.to.next(msg);
        // Extract soul from message
        const soul = msg.get['#'];
        const field = msg.get['.'];

        try {
          const recordDB = await ctx.call('db', 'getRecords');
          let node;

          if (field) {
            const record = await recordDB.findOne(soul, field);

            if (!record) throw new Error(`no record found`);

            const { relation, state, value } = record;
            const val = relation ? Val.rel.ify(relation) : value;
            node = State.ify(node, record.field, state, val, soul);
            node = State.to(node, field);
          } else {
            const records = await recordDB.findAll(soul);
            for (const record of records) {
              const { relation, state, value } = record;
              const val = relation ? Val.rel.ify(relation) : value;
              node = State.ify(node, record.field, state, val, soul);
            }
          }

          logger.debug('handled GET', {
            field,
            origin: 'gun',
            soul,
          });

          // @ts-expect-error
          gun.on('in', {
            '@': msg['#'],
            put: Graph.node(node),
          });
        } catch (e) {
          logger.error('error processing GET', {
            error: e.message,
            field,
            origin: 'gun',
            soul,
            stack: e.stack,
          });
        }
      });
    });

    // @ts-expect-error
    this.gun = gun;

    const userDB = await this.call('db', 'getUsers');
    const users = await userDB.readAll('', 0, 1000);

    // for (const user of users) {
    //   await this.watch(user.pubkey);
    // }
    //
    // await this.watchGlobal();

    logger.info(`gun server listening at ${config.gunPort}...`);
  }
}
