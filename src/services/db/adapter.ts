import {
  EmptyUserMeta,
  GenericDBAdapterInterface,
  PostMeta,
  Post,
  Profile,
  Moderation,
  Connection,
  User,
  UserMeta,
  Proof,
  GroupMember, PostJSON, ModerationJSON, ConnectionJSON,
} from 'zkitter-js';
import DBService from '@services/db';
import MerkleService from '@services/merkle';
import logger from '@util/logger';
import {
  ConnectionMessageSubType,
  ModerationMessageSubType,
  parseMessageId,
  PostMessageSubType,
  ProfileMessageSubType
} from '@util/message';
import { HASHTAG_REGEX, MENTION_REGEX } from '@util/regex';
import ENSService from "@services/ens";
import {showStatus} from "@util/twitter";
import ZKChatService from "@services/zkchat";
import {covertToGroupId} from "@models/semaphore_creators";
import {toBigInt} from "@util/encoding";
import {AnyMessage} from "zkitter-js/dist/src/utils/message";

export class PostgresAdapter implements GenericDBAdapterInterface {
  db: DBService;
  merkle: MerkleService;
  ens: ENSService;
  zkchat: ZKChatService;

  constructor(db: DBService, merkle: MerkleService, ens: ENSService, zkchat: ZKChatService) {
    this.db = db;
    this.merkle = merkle;
    this.ens = ens;
    this.zkchat = zkchat;
  }

  async updateUser(user: User): Promise<User> {
    await this.db.users!.updateOrCreateUser({
      name: user.address,
      pubkey: user.pubkey,
      joinedAt: user.joinedAt.getTime(),
      tx: user.tx,
      type: user.type,
    });

    return user;
  }

  async getUserCount(): Promise<number> {
    return 0;
  };

  async getLastArbitrumBlockScanned(): Promise<number> {
    const data = await this.db.app!.read();
    const lastBlock = data?.lastArbitrumBlockScanned;
    return lastBlock || 2193241;
  }

  async updateLastArbitrumBlockScanned(block: number): Promise<number> {
    await this.db.app!.updateLastArbitrumBlock(block);
    return block;
  }

  async getUsers(limit?: number, offset?: number | string): Promise<User[]> {
    const rows = await this.db.users?.readAll('', offset as number, limit);
    return !rows
      ? []
      : rows.map(row => {
        return {
          address: row.name,
          pubkey: row.pubkey,
          joinedAt: new Date(row.joinedAt),
          tx: row.joinedTx,
          type: 'arbitrum',
        };
      });
  }

  async getUser(address: string): Promise<User | null> {
    const row = await this.db.users?.findOneByName(address);
    return !row
      ? null
      : {
        address: row.name,
        pubkey: row.pubkey,
        joinedAt: new Date(row.joinedAt),
        tx: row.joinedTx,
        type: 'arbitrum',
      };
  }

  async getUserMeta(address: string): Promise<UserMeta> {
    const user = await this.db.users?.findOneByName(address);

    return {
      ...EmptyUserMeta(),
      nickname: user?.name || '',
      coverImage: user?.coverImage || '',
      profileImage: user?.profileImage || '',
      website: user?.website || '',
      twitterVerification: user?.twitterVerification || '',
      group: user?.group || false,
      bio: user?.bio || '',
      ecdh: user?.ecdh || '',
      idCommitment: user?.idcommitment || '',
      followers: user?.meta.followerCount || 0,
      following: user?.meta.followingCount || 0,
      blockers: user?.meta.blockedCount || 0,
      blocking: user?.meta.blockingCount || 0,
      posts: user?.meta.postingCount || 0,
    };
  }

  getProof: (hash: string) => Promise<Proof | null>;

  async insertGroupMember(groupId: string, member: GroupMember): Promise<GroupMember | null> {
    const hex = '0x' + toBigInt(member.newRoot).toString(16);
    const group = await this.db.merkleRoot?.getGroupByRoot(hex);
    if (!group) await this.db.merkleRoot?.addRoot(hex, groupId);
    return null;
  }

  async getGroupMembers(
    groupId: string,
    limit?: number,
    offset?: number | string
  ): Promise<string[]> {
    const leaves = await this.merkle.getAllLeaves(groupId);
    return leaves.map(leaf => '0x' + leaf.id_commitment);
  }

  async findGroupHash(hash: string): Promise<string | null> {
    const hex = toBigInt(hash).toString(16);
    const group = await this.db.merkleRoot?.getGroupByRoot('0x' + hex);
    return group?.group_id || null;
  }

  // @ts-ignore
  async insertPost(post: Post, proof: Proof): Promise<Post> {
    const json = await post.toJSON();

    const { createdAt, hash, messageId, payload, subtype, type } = json;

    const creator = post.creator;
    const postDB = this.db.posts;
    const metaDB = this.db.meta;
    const userMetaDB = this.db.userMeta;
    const semaphoreCreatorsDB = this.db.semaphoreCreators;
    const tagDB = this.db.tags;
    const threadsDB = this.db.threads;

    const result = await postDB!.findOne(hash);

    if (result) {
      logger.debug('post already exist', {
        messageId,
        origin: 'gun',
      });
      throw new Error('post already exist');
    }

    try {
      let groupId;

      if (proof.type === 'rln') {
        groupId = await this.findGroupHash(proof.proof.publicSignals.merkleRoot as string);
      } else if (proof.type === '' && proof.group) {
        groupId = proof.group;
      }

      if (groupId) {
        const [, groupName, groupType] = groupId.split('_');
        await semaphoreCreatorsDB!.addSemaphoreCreator(messageId, groupName, groupType);
      }

      await postDB!.createPost({
        attachment: payload.attachment,
        content: payload.content,
        createdAt: createdAt,
        creator: creator || '',
        hash: hash,
        messageId: messageId,
        proof: JSON.stringify(proof),
        reference: payload.reference,
        subtype: subtype,
        title: payload.title,
        topic: payload.topic,
        type: type,
      });

      if (payload.reference) {
        try {
          new URL(payload.reference);
        } catch (e) {
          await postDB!.ensurePost(payload.reference);
        }

        if (subtype === PostMessageSubType.Reply) {
          await metaDB!.addReply(payload.reference);
        }

        if (subtype === PostMessageSubType.Repost) {
          await metaDB!.addRepost(payload.reference);
        }

        const root = await postDB!.findRoot(messageId);

        if (root) {
          await threadsDB!.addThreadData(root, messageId);
        }
      } else {
        await threadsDB!.addThreadData(messageId, messageId);
      }

      if (!payload.reference && creator) {
        await userMetaDB!.addPostingCount(creator);
      }

      const tags = payload.content?.match(HASHTAG_REGEX);

      if (tags) {
        for (const tagName of tags) {
          await tagDB!.addTagPost(tagName, messageId);
          await metaDB!.addPost(tagName);
        }
      }

      const mentions = payload.content?.match(MENTION_REGEX);

      if (mentions) {
        for (const mention of mentions) {
          const addr = await this.ens.fetchAddressByName(mention.slice(1));
          await userMetaDB!.addMentionedCount(addr);
          await tagDB!.addTagPost('@' + addr, messageId);
        }
      }

      logger.info(`insert post`, {
        messageId,
        origin: 'gun',
      });

      return post;
    } catch (e) {
      console.log(e);
      logger.error(`error inserting post`, {
        error: e.message,
        messageId,
        origin: 'gun',
        parent: e.parent,
        stack: e.stack,
      });
    }
  }

  // @ts-ignore
  async insertModeration(moderation: Moderation, proof: Proof): Promise<Moderation> {
    const json = await moderation.toJSON();
    const { createdAt, messageId, payload, subtype, type } = json;

    const { creator, hash } = parseMessageId(messageId);

    const moderationDB = this.db.moderations!;
    const postDB = this.db.posts!;
    const metaDB = this.db.meta!;

    const result = await moderationDB.findOne(hash);

    if (result) {
      logger.debug('moderation already exist', {
        messageId,
        origin: 'gun',
      });
      throw new Error('moderation already exist');
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

  // @ts-ignore
  async insertConnection(connection: Connection, proof: Proof): Promise<Connection> {
    const json = await connection.toJSON();
    const { createdAt, messageId, payload, subtype, type } = json;
    const [creator, hash] = messageId.split('/');

    const connDB = this.db.connections!;
    const userDB = this.db.users!;
    const userMetaDB = this.db.userMeta!;

    const result = await connDB.findOne(hash);

    if (result) {
      logger.debug('connection already exist', {
        messageId,
        origin: 'gun',
      });
      throw new Error('connection already exist');
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

  // @ts-ignore
  async insertProfile(profile: Profile, proof: Proof): Promise<Profile> {
    const json = await profile.toJSON();
    const { createdAt, messageId, payload, subtype, type } = json;
    const { creator, hash } = parseMessageId(messageId);

    const profileDB = this.db.profiles!;
    const twitterAuthDb = this.db.twitterAuth!;
    const result = await profileDB.findOne(hash);

    if (result) {
      logger.debug('profile already exist', {
        messageId,
        origin: 'gun',
      });
      throw new Error('profile already exist');
    }

    if (subtype === ProfileMessageSubType.Custom && payload.key === 'ecdh_pubkey') {
      await this.zkchat.registerUser(creator, payload.value);
    }

    if (subtype === ProfileMessageSubType.TwitterVerification) {
      const { key, value } = payload;

      if (!key || !value) {
        // @ts-ignore
        return;
      }

      const {
        entities: {
          urls: [{ expanded_url: profileUrl }],
        },
        user: { screen_name },
      } = await showStatus(value);

      if (screen_name !== key) {
        // @ts-ignore
        return;
      }

      if (!profileUrl.includes(creator)) {
        // @ts-ignore
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
  };

  async getHistoryDownloaded(): Promise<boolean> {
    return true;
    return process.env.NODE_ENV === 'production';
  };

  async setHistoryDownloaded(downloaded: boolean): Promise<void> {};

  async getMessagesByUser(
    address: string,
    limit?: number,
    offset?: number | string
  ): Promise<AnyMessage[]> {
    return [];
  };

  async getPostMeta(postHash: string): Promise<PostMeta> {
    const data = await this.db.posts?.findOne(postHash);
    return {
      like: data?.meta.likeCount,
      reply: data?.meta.replyCount,
      repost: data?.meta.repostCount,
      block: 0,
      global: false,
      moderation: data?.meta.moderation,
      groupId: covertToGroupId(data?.meta.interepProvider, data?.meta.interepGroup),
    };
  };

  async getPost(hash: string): Promise<Post | null> {
    const json = await this.db.posts?.findOne(hash);
    if (!json) return null;

    const {creator} = parseMessageId(json.messageId);

    const post =  new Post({
      type: json.type,
      subtype: json.subtype,
      creator: creator,
      createdAt: new Date(json.createdAt),
      payload: {
        content: json.payload.content,
        reference: json.payload.reference,
        topic: json.payload.topic,
        title: json.payload.title,
        attachment: json.payload.attachment,
      }
    });

    if (post.hash() !== hash) throw new Error('error making post');

    return post;
  };

  async getPosts(limit?: number, offset?: number | string): Promise<Post[]> {
    const posts = await this.db.posts?.findAllPosts(
      undefined,
      undefined,
      offset as number,
      limit,
    );

    return !posts ? [] : posts.map(jsonToPost)
  };

  async getUserPosts(address: string, limit?: number, offset?: number | string): Promise<Post[]> {
    const posts = await this.db.posts?.findAllPosts(
      address,
      undefined,
      offset as number,
      limit,
    );

    return !posts ? [] : posts.map(jsonToPost)
  };

  async getReplies(hash: string, limit?: number, offset?: number | string): Promise<Post[]> {
    const posts = await this.db.posts?.findAllReplies(
      hash,
      undefined,
      offset as number,
      limit,
    );

    return !posts ? [] : posts.map(jsonToPost);
  };

  async getReposts(hash: string, limit?: number, offset?: number | string): Promise<string[]> {
    const result = await this.db.posts?.model.findAll({
      where: {
        reference: hash,
        subtype: PostMessageSubType.Repost,
      },
      limit,
      offset: Number(offset),
    });

    if (!result) return [];

    return result.map(row => row.toJSON().messageId);
  }

  async getModerations(hash: string, limit?: number, offset?: number | string): Promise<Moderation[]> {
    const result = await this.db.moderations?.model.findAll({
      where: {
        reference: hash,
      },
      limit,
      offset: Number(offset),
    });

    if (!result) return [];

    return result.map(row => jsonToModeration(row.toJSON()));
  }

  async getConnections(
    address: string,
    limit?: number,
    offset?: number | string
  ): Promise<Connection[]> {
    const result = await this.db.connections?.model.findAll({
      where: {
        name: address,
      },
      limit,
      offset: Number(offset),
    });

    if (!result) return [];

    return result.map(row => jsonToConnection(row.toJSON()));
  }

  async getFollowings(address: string): Promise<string[]> {
    const result = await this.db.connections?.model.findAll({
      where: {
        creator: address,
      },
    });

    if (!result) return [];

    return result.map(row => jsonToConnection(row.toJSON()).creator);
  }

  async getHomefeed(
    filter: {
      addresses: { [address: string]: true };
      groups: { [groupId: string]: true };
    },
    limit = -1,
    offset?: number|string
  ): Promise<Post[]> {
    return [];
  }
}

function jsonToPost(json: PostJSON) {
  const {creator} = parseMessageId(json.messageId);
  return new Post({
    type: json.type,
    subtype: json.subtype,
    creator: creator,
    createdAt: new Date(Number(json.createdAt)),
    payload: {
      content: json.payload.content,
      reference: json.payload.reference,
      topic: json.payload.topic,
      title: json.payload.title,
      attachment: json.payload.attachment,
    },
  });
}

function jsonToModeration(json: ModerationJSON) {
  const {creator} = parseMessageId(json.messageId);
  return new Moderation({
    type: json.type,
    subtype: json.subtype,
    creator: creator,
    createdAt: new Date(json.createdAt),
    payload: {
      reference: json.payload.reference,
    },
  });
}

function jsonToConnection(json: ConnectionJSON) {
  const {creator} = parseMessageId(json.messageId);
  return new Connection({
    type: json.type,
    subtype: json.subtype,
    creator: creator,
    createdAt: new Date(json.createdAt),
    payload: {
      name: json.payload.name,
    },
  });
}