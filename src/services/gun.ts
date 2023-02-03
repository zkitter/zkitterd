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

  watchGlobal = async () => {
    if (!this.gun) throw new Error('gun is not set up');

    this.gun.get('message').map(async (data, messageId) => {
      try {
        await this.handleGunMessage(data, messageId);
      } catch (e) {
        logger.error(e.message, e);
      }
    });
  };

  watch = async (pubkey: string) => {
    if (!this.gun) throw new Error('gun is not set up');

    // const users = await this.call('db', 'getUsers');
    // const user = await users.findOneByPubkey(pubkey);
    //
    // if (!user) throw new Error(`cannot find user with pubkey ${pubkey}`);

    this.gun
      .user(pubkey)
      .get('message')
      .map(async (data, messageId) => {
        try {
          await this.handleGunMessage(data, messageId, pubkey);
        } catch (e) {
          logger.error(e.message, e);
        }
      });
  };

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
        const post = new Post({
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
        return {
          ...post,
          proof: data.proof,
          publicSignals: data.publicSignals,
        };
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

  handleGunMessage = async (data: any, messageId: string, pubkey?: string) => {
    return insertMutex.runExclusive(async () => {
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
        await this.deleteMessage(messageId);
        return;
      }

      const type = Message.getType(data.type);

      if (!type) return;

      if (data.payload) {
        // @ts-expect-error
        payload = await this.gun.get(data.payload['#']);
      }

      switch (type) {
        case MessageType.Post:
          const post = new Post({
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
          await this.insertPost(
            post,
            !data.proof
              ? undefined
              : {
                  epoch: data.epoch,
                  group: data.group,
                  proof: data.proof,
                  publicSignals: data.publicSignals,
                  x_share: data.x_share,
                }
          );
          return;
        case MessageType.Moderation:
          const moderation = new Moderation({
            createdAt: new Date(Number(data.createdAt)),
            creator: creator,
            payload: {
              reference: payload.reference,
            },
            subtype: Moderation.getSubtype(data.subtype),
            type: type,
          });
          await this.insertModeration(moderation);
          return;
        case MessageType.Connection:
          const connection = new Connection({
            createdAt: new Date(Number(data.createdAt)),
            creator: creator,
            payload: {
              name: payload.name,
            },
            subtype: Connection.getSubtype(data.subtype),
            type: type,
          });
          await this.insertConnection(connection);
          return;
        case MessageType.Profile:
          const profile = new Profile({
            createdAt: new Date(Number(data.createdAt)),
            creator: creator,
            payload: {
              key: payload.key,
              value: payload.value,
            },
            subtype: Profile.getSubtype(data.subtype),
            type: type,
          });
          await this.insertProfile(profile);
          return;
      }
    });
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

  async insertPost(
    post: Post,
    data?: {
      proof: string;
      publicSignals: string;
      x_share: string;
      epoch: string;
      group?: string;
    }
  ) {
    const json = await post.toJSON();

    const { createdAt, hash, messageId, payload, subtype, type } = json;

    const creator = post.creator;
    const postDB = await this.call('db', 'getPosts');
    const metaDB = await this.call('db', 'getMeta');
    const userMetaDB = await this.call('db', 'getUserMeta');
    const semaphoreCreatorsDB = await this.call('db', 'getSemaphoreCreators');
    const tagDB = await this.call('db', 'getTags');
    const threadsDB = await this.call('db', 'getThreads');

    if (json.hash !== hash) {
      return;
    }

    const result = await postDB.findOne(hash);

    if (result) {
      logger.debug('post already exist', {
        messageId,
        origin: 'gun',
      });
      return;
    }

    if (!creator && !data) {
      return;
    }

    try {
      if (data) {
        const proof = JSON.parse(data.proof);
        const publicSignals = JSON.parse(data.publicSignals);

        let verified = false;

        if (!data.x_share) {
          verified = await Semaphore.verifyProof(vKey as any, {
            proof,
            publicSignals,
          });

          if (!verified) return;
        } else {
          verified = await this.call('zkchat', 'verifyRLNProof', {
            epoch: data.epoch,
            proof,
            publicSignals,
            x_share: data.x_share,
          });

          const share = {
            epoch: publicSignals.epoch,
            nullifier: publicSignals.internalNullifier,
            x_share: data.x_share,
            y_share: publicSignals.yShare,
          };

          const { isDuplicate, isSpam } = await this.call('zkchat', 'checkShare', share);

          if (isSpam || isDuplicate || !verified) return;
        }

        const group = await this.call(
          'merkle',
          'getGroupByRoot',
          '0x' + BigInt(publicSignals.merkleRoot).toString(16)
        );

        if (!group) return;

        const [, groupName, groupType] = group.split('_');
        await semaphoreCreatorsDB.addSemaphoreCreator(messageId, groupName, groupType);
      }

      await postDB.createPost({
        attachment: payload.attachment,
        content: payload.content,
        createdAt: createdAt,
        creator: creator || '',
        hash: hash,
        messageId: messageId,
        proof: data?.proof,
        reference: payload.reference,
        signals: data?.publicSignals,
        subtype: subtype,
        title: payload.title,
        topic: payload.topic,
        type: type,
      });

      if (payload.reference) {
        try {
          new URL(payload.reference);
        } catch (e) {
          await postDB.ensurePost(payload.reference);
        }

        if (subtype === PostMessageSubType.Reply) {
          await metaDB.addReply(payload.reference);
        }

        if (subtype === PostMessageSubType.Repost) {
          await metaDB.addRepost(payload.reference);
        }

        const root = await postDB.findRoot(messageId);

        if (root) {
          await threadsDB.addThreadData(root, messageId);
        }
      } else {
        await threadsDB.addThreadData(messageId, messageId);
      }

      if (!payload.reference && creator) {
        await userMetaDB.addPostingCount(creator);
      }

      const tags = payload.content?.match(HASHTAG_REGEX);

      if (tags) {
        for (const tagName of tags) {
          await tagDB.addTagPost(tagName, messageId);
          await metaDB.addPost(tagName);
        }
      }

      const mentions = payload.content?.match(MENTION_REGEX);

      if (mentions) {
        for (const mention of mentions) {
          const addr = await this.call('ens', 'fetchAddressByName', mention.slice(1));
          await userMetaDB.addMentionedCount(addr);
          await tagDB.addTagPost('@' + addr, messageId);
        }
      }

      logger.info(`insert post`, {
        messageId,
        origin: 'gun',
      });
    } catch (e) {
      logger.error(`error inserting post`, {
        error: e.message,
        messageId,
        origin: 'gun',
        parent: e.parent,
        stack: e.stack,
      });
    }
  }

  async insertModeration(moderation: Moderation) {
    const json = await moderation.toJSON();
    const { createdAt, messageId, payload, subtype, type } = json;

    const { creator, hash } = parseMessageId(messageId);

    const moderationDB = await this.call('db', 'getModerations');
    const postDB = await this.call('db', 'getPosts');
    const metaDB = await this.call('db', 'getMeta');

    if (json.hash !== hash) {
      return;
    }

    const result = await moderationDB.findOne(hash);

    if (result) {
      logger.debug('moderation already exist', {
        messageId,
        origin: 'gun',
      });
      return;
    }

    try {
      await postDB.ensurePost(payload.reference);
      await moderationDB.createModeration({
        createdAt: createdAt,
        creator: creator || '',
        hash: hash,
        messageId,
        reference: payload.reference,
        subtype: subtype,
        type: type,
      });

      if (subtype === ModerationMessageSubType.Like && payload.reference) {
        await metaDB.addLike(payload.reference);
      }

      logger.info(`insert moderation`, {
        messageId,
        origin: 'gun',
      });
    } catch (e) {
      logger.error(`error inserting moderation`, {
        error: e.message,
        messageId,
        origin: 'gun',
        parent: e.parent,
        stack: e.stack,
      });
    }
  }

  async insertConnection(connection: Connection) {
    const json = await connection.toJSON();
    const { createdAt, messageId, payload, subtype, type } = json;
    const [creator, hash] = messageId.split('/');

    const connDB = await this.call('db', 'getConnections');
    const userDB = await this.call('db', 'getUsers');
    const userMetaDB = await this.call('db', 'getUserMeta');

    if (json.hash !== hash) {
      return;
    }

    const result = await connDB.findOne(hash);

    if (result) {
      logger.debug('connection already exist', {
        messageId,
        origin: 'gun',
      });
      return;
    }

    try {
      await userDB.ensureUser(payload.name);

      await connDB.createConnection({
        createdAt: createdAt,
        creator: creator || '',
        hash: hash,
        messageId,
        name: payload.name,
        subtype: subtype,
        type: type,
      });

      if (subtype === ConnectionMessageSubType.Follow) {
        await userMetaDB.addFollower(payload.name);
        await userMetaDB.addFollowing(creator);
      } else if (subtype === ConnectionMessageSubType.Block) {
        await userMetaDB.addBlocked(payload.name);
        await userMetaDB.addBlocking(creator);
      }

      logger.info(`insert connection`, {
        messageId,
        origin: 'gun',
      });
    } catch (e) {
      logger.error(`error inserting connection`, {
        error: e.message,
        messageId,
        origin: 'gun',
        parent: e.parent,
        stack: e.stack,
      });
    }
  }

  async insertProfile(profile: Profile) {
    const json = await profile.toJSON();
    const { createdAt, messageId, payload, subtype, type } = json;
    const { creator, hash } = parseMessageId(messageId);

    const profileDB = await this.call('db', 'getProfiles');
    const twitterAuthDb = await this.call('db', 'getTwitterAuth');

    if (json.hash !== hash) {
      return;
    }

    const result = await profileDB.findOne(hash);

    if (result) {
      logger.debug('profile already exist', {
        messageId,
        origin: 'gun',
      });
      return;
    }

    if (subtype === ProfileMessageSubType.Custom && payload.key === 'ecdh_pubkey') {
      await this.call('zkchat', 'registerUser', creator, payload.value);
    }

    if (subtype === ProfileMessageSubType.TwitterVerification) {
      const { key, value } = payload;

      if (!key || !value) return;

      const {
        entities: {
          urls: [{ expanded_url: profileUrl }],
        },
        user: { screen_name },
      } = await showStatus(value);

      if (screen_name !== key) {
        return;
      }

      if (!profileUrl.includes(creator)) {
        return;
      }

      await twitterAuthDb.addAccount(key, creator);
    }

    try {
      await profileDB.createProfile({
        createdAt: createdAt,
        creator: creator,
        hash: hash,
        key: payload.key,
        messageId,
        subtype: subtype,
        type: type,
        value: payload.value,
      });

      logger.info(`insert profile`, {
        messageId,
        origin: 'gun',
      });
    } catch (e) {
      logger.error(`error inserting profile`, {
        error: e.message,
        messageId,
        origin: 'gun',
        parent: e.parent,
        stack: e.stack,
      });
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

    for (const user of users) {
      await this.watch(user.pubkey);
    }

    await this.watchGlobal();

    logger.info(`gun server listening at ${config.gunPort}...`);
  }
}
