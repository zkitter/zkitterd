import { EmptyUserMeta, GenericDBAdapterInterface } from 'zkitter-js';
import { User } from 'zkitter-js';
import { UserMeta } from 'zkitter-js';
import { Proof } from 'zkitter-js';
import { GroupMember } from 'zkitter-js/dist/src/models/group';
import { Message, Post, Profile, Moderation, Connection } from 'zkitter-js/dist/src/utils/message';
import { PostMeta } from 'zkitter-js';
import DBService from '@services/db';
import MerkleService from '@services/merkle';
import logger from '@util/logger';
import { Semaphore } from '@zk-kit/protocols';
import vKey from '#/verification_key.json';
import { PostMessageSubType } from '@util/message';
import { HASHTAG_REGEX, MENTION_REGEX } from '@util/regex';

export class PostgresAdapter implements GenericDBAdapterInterface {
  db: DBService;
  merkle: MerkleService;

  constructor(db: DBService, merkle: MerkleService) {
    this.db = db;
    this.merkle = merkle;
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

  getUserCount: () => Promise<number>;

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
    // noop
    return null;
  }

  async getGroupMembers(
    groupId: string,
    limit?: number,
    offset?: number | string
  ): Promise<string[]> {
    const leaves = await this.merkle.getAllLeaves(groupId);
    return leaves.map(leaf => leaf.id_commitment);
  }

  async findGroupHash(hash: string): Promise<string | null> {
    const group = await this.db.merkleRoot?.getGroupByRoot(hash);
    return group?.group_id || null;
  }

  async insertPost(post: Post, proof: Proof): Promise<Post> {
    const json = await post.toJSON();

    const { createdAt, hash, messageId, payload, subtype, type } = json;

    console.log(post);
    return;

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

  insertModeration: (moderation: Moderation, proof: Proof) => Promise<Moderation | null>;
  insertConnection: (connection: Connection, proof: Proof) => Promise<Connection | null>;
  insertProfile: (profile: Profile, proof: Proof) => Promise<Profile | null>;

  getMessagesByUser: (
    address: string,
    limit?: number,
    offset?: number | string
  ) => Promise<Message[]>;

  getPostMeta: (postHash: string) => Promise<PostMeta>;
  getPost: (hash: string) => Promise<Post | null>;
  getPosts: (limit?: number, offset?: number | string) => Promise<Post[]>;
  getUserPosts: (address: string, limit?: number, offset?: number | string) => Promise<Post[]>;

  getReplies: (hash: string, limit?: number, offset?: number | string) => Promise<Post[]>;
  getReposts: (hash: string, limit?: number, offset?: number | string) => Promise<string[]>;
  getModerations: (hash: string, limit?: number, offset?: number | string) => Promise<Moderation[]>;
  getConnections: (
    address: string,
    limit?: number,
    offset?: number | string
  ) => Promise<Connection[]>;
}
