import {
  Chat,
  Connection,
  ConnectionJSON,
  ConnectionMessageSubType,
  EmptyUserMeta,
  Filter,
  GenericDBAdapterInterface,
  GroupMember,
  Message,
  MessageType,
  Moderation,
  ModerationJSON,
  ModerationMessageSubType,
  parseMessageId,
  Post,
  PostJSON,
  PostMessageSubType,
  PostMeta,
  Profile,
  ProfileMessageSubType,
  Proof,
  User,
  UserMeta,
} from 'zkitter-js';
import DBService from '@services/db';
import MerkleService from '@services/merkle';
import logger from '@util/logger';
import {HASHTAG_REGEX, MENTION_REGEX} from '@util/regex';
import ENSService from "@services/ens";
import {showStatus} from "@util/twitter";
import ZKChatService from "@services/zkchat";
import {covertToGroupId} from "@models/semaphore_creators";
import {toBigInt} from "@util/encoding";
import {AnyMessage} from "zkitter-js/dist/src/utils/message";
import {ChatMeta} from "zkitter-js/dist/src/models/chats";
import {UserMetaKey} from "zkitter-js/dist/src/models/usermeta";
import {QueryTypes} from "sequelize";

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
    const values = await this.db.sequelize.query('SELECT COUNT(*) from users', { type: QueryTypes.SELECT });
    return (values[0] as {  count: number }).count;
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
      group: user?.group ? 'true' : '',
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

  async getProof(hash: string): Promise<Proof | null> {
    const value = await this.db.message?.findOne(hash);
    return value?.proof ? JSON.parse(value.proof) : null;
  };

  async insertGroupMember(groupId: string, member: GroupMember): Promise<GroupMember | null> {
    const hex = '0x' + toBigInt(member.newRoot).toString(16);
    const group = await this.db.merkleRoot?.getGroupByRoot(hex);
    if (!group) await this.db.merkleRoot?.addRoot(hex, groupId);
    const m = await this.db.semaphore?.findOne(toBigInt(member.idCommitment).toString(16), groupId);
    if (!m) await this.db.semaphore?.addID(BigInt(member.idCommitment).toString(16), groupId, hex);
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

  async getHistoryDownloaded(): Promise<boolean> {
    const appData = await this.db.app!.read();
    return appData.historyDownloaded;
  };

  async setHistoryDownloaded(downloaded: boolean): Promise<void> {
    await this.db.app!.updateHistoryDownloaded(downloaded);
  };

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

  removeFromGroupPosts(post: Post, proof: Proof): Promise<void> {
    // TODO: to be implemented
    return Promise.resolve(undefined);
  }

  getGroupPosts(groupId: string, limit: number | undefined, offset: number | string | undefined): Promise<Post[]> {
    // TODO: to be implemented
    return Promise.resolve([]);
  }

  async addMessage(msg: Message): Promise<void> {
    await this.db.message?.updateMessage(msg.hash(), msg.creator, msg.type);

    switch (msg.type) {
      case MessageType.Post: {
        const post = msg as Post;
        const {messageId} = post.toJSON();
        const tags = post.payload.content?.match(HASHTAG_REGEX);

        if (tags) {
          for (const tagName of tags) {
            await this.db.tags!.addTagPost(tagName, messageId);
            await this.db.meta!.addPost(tagName);
          }
        }

        const mentions = post.payload.content?.match(MENTION_REGEX);

        if (mentions) {
          for (const mention of mentions) {
            const addr = await this.ens.fetchAddressByName(mention.slice(1));
            await this.db.userMeta!.addMentionedCount(addr);
            await this.db.tags!.addTagPost('@' + addr, messageId);
          }
        }
        break;
      }
      case MessageType.Profile: {
        const profile = msg as Profile;
        const { messageId, subtype, payload, createdAt, hash } = profile.toJSON();
        if (subtype === ProfileMessageSubType.TwitterVerification) {
          const { key, value } = payload;

          if (!key || !value) return;

          const {
            entities: {
              urls: [{ expanded_url: profileUrl }],
            },
            user: { screen_name },
          } = await showStatus(value);

          if (screen_name !== key) return;
          if (!profileUrl.includes(profile.creator)) return;

          await this.db.twitterAuth!.addAccount(key, profile.creator);
        }

        await this.db.profiles!.createProfile({
          createdAt: createdAt,
          creator: profile.creator,
          hash: hash,
          key: payload.key,
          messageId,
          subtype: subtype,
          type: MessageType.Profile,
          value: payload.value,
        });

        break;
      }
    }
  }

  async addProof(msg: Message, proof: Proof): Promise<void> {
    await this.db.message?.updateProof(msg.hash(), JSON.stringify(proof));
  }

  async addToGroupPosts(post: Post, proof: Proof): Promise<void> {
    if (proof.type === 'rln') {
      const groupId = proof.groupId;
      const [, groupName, groupType] = groupId.split('_');
      const {messageId} = post.toJSON();
      await this.db.semaphoreCreators!.addSemaphoreCreator(messageId, groupName, groupType);
    }
  }

  async addToPostlist(post: Post): Promise<void> {
    const { messageId, hash } = post.toJSON();

    await this.db.posts?.createPost({
      type: MessageType.Post,
      subtype: post.subtype,
      creator: post.creator,
      createdAt: post.createdAt.getTime(),
      hash,
      messageId,
      content: post.payload.content,
      reference: post.payload.reference,
      attachment: post.payload.attachment,
      topic: post.payload.topic,
      title: post.payload.title,
    });

    return Promise.resolve(undefined);
  }

  async decrementCreatorPostCount(post: Post): Promise<void> {
    if (post.creator) {
      await this.db.userMeta!.removePostingCount(post.creator);
    }
  }

  async decrementLikeCount(mod: Moderation): Promise<void> {
    await this.db.meta!.removeLike(mod.payload.reference);
  }

  async decrementReplyCount(post: Post): Promise<void> {
    await this.db.meta!.removeReply(post.payload.reference);
  }

  async decrementRepostCount(post: Post): Promise<void> {
    await this.db.meta!.removeRepost(post.payload.reference);
  }

  async getMessage(hash: string): Promise<AnyMessage | null> {
    const msg = await this.db.message?.findOne(hash);

    if (msg) {
      switch (msg.type) {
        case 'POST': {
          const json = await this.db.posts?.findOne(hash);
          if (json) return Post.fromJSON(json);
          return null;
        }
        case 'MODERATION': {
          const mod = await this.db.moderations?.findOne(hash);
          if (mod) {
            return new Moderation({
              type: MessageType.Moderation,
              subtype: mod.subtype as ModerationMessageSubType,
              creator: mod.creator,
              createdAt: new Date(Number(mod.createdAt)),
              payload: {
                reference: mod.reference,
              },
            });
          }
          return null;
        }
        case 'CONNECTION': {
          const conn = await this.db.connections?.findOne(hash);
          if (conn) {
            return new Connection({
              type: MessageType.Connection,
              subtype: conn.subtype as ConnectionMessageSubType,
              creator: conn.creator,
              createdAt: new Date(Number(conn.createdAt)),
              payload: {
                name: conn.name,
              },
            });
          }
          return null;
        }
        case 'PROFILE': {
          const profile = await this.db.profiles?.findOne(hash);
          if (profile) {
            return new Profile({
              type: MessageType.Profile,
              subtype: profile.subtype as ProfileMessageSubType,
              creator: profile.creator,
              createdAt: new Date(Number(profile.createdAt)),
              payload: {
                key: profile.key,
                value: profile.value,
              },
            });
          }
          return null;
        }
        default:
          return null;
      }
    }

    return null;
  }

  async incrementCreatorPostCount(post: Post): Promise<void> {
    if (post.creator) {
      await this.db.userMeta!.addPostingCount(post.creator);
    }
  }

  async incrementLikeCount(mod: Moderation): Promise<void> {
    await this.db.meta!.addLike(mod.payload.reference);
  }

  async incrementReplyCount(post: Post): Promise<void> {
    await this.db.meta!.addReply(post.payload.reference);
  }

  async incrementRepostCount(post: Post): Promise<void> {
    await this.db.meta!.addRepost(post.payload.reference);
  }

  async removeFromPostlist(post: Post): Promise<void> {
    await this.db.posts?.remove(post.hash());
  }

  async addToConnections(conn: Connection): Promise<void> {
    const { messageId, hash } = conn.toJSON();
    await this.db.connections!.createConnection({
      messageId,
      hash,
      creator: conn.creator,
      type: MessageType.Connection,
      subtype: conn.subtype,
      createdAt: conn.createdAt.getTime(),
      name: conn.payload.name,
    })
  }

  async decrementBlockerCount(conn: Connection): Promise<void> {
    await this.db.userMeta?.removeBlocked(conn.payload.name);
    await this.db.userMeta?.removeBlocking(conn.creator);
  }

  async decrementFollowerCount(conn: Connection): Promise<void> {
    await this.db.userMeta?.removeFollower(conn.payload.name);
    await this.db.userMeta?.removeFollowing(conn.creator);
  }

  async incrementBlockerCount(conn: Connection): Promise<void> {
    await this.db.userMeta?.addBlocked(conn.payload.name);
    await this.db.userMeta?.addBlocking(conn.creator);
  }

  async incrementFollowerCount(conn: Connection): Promise<void> {
    await this.db.userMeta?.addFollower(conn.payload.name);
    await this.db.userMeta?.addFollowing(conn.creator);
  }

  async removeFromConnections(conn: Connection): Promise<void> {
    await this.db.connections!.remove(conn.hash());
  }

  getUserByECDH(ecdh: string): Promise<string | null> {
    return this.db.profiles!.findUserByECDH(ecdh);
  }

  async revertMessage(msg: Message): Promise<void> {
    await this.db.message?.remove(msg.hash());
  }

  async addToThread(post: Post): Promise<void> {
    const {messageId, payload, createdAt, hash, subtype} = post.toJSON();

    await this.db.posts!.createPost({
      attachment: payload.attachment,
      content: payload.content,
      createdAt: createdAt,
      creator: post.creator || '',
      hash: hash,
      messageId: messageId,
      reference: payload.reference,
      subtype: subtype,
      title: payload.title,
      topic: payload.topic,
      type: MessageType.Post,
    });

    if (post.payload.reference) {
      const root = await this.db.posts!.findRoot(post.payload.reference);
      if (root) {
        await this.db.threads!.addThreadData(root, messageId);
      }
    } else {
      await this.db.threads!.addThreadData(messageId, messageId);
    }
  }

  async removeFromThread(post: Post): Promise<void> {
    const {messageId} = post.toJSON();
    if (post.payload.reference) {
      await this.db.threads!.removeThreadData(messageId, post.payload.reference);
    } else {
      await this.db.threads!.removeThreadData(messageId, messageId);
    }
  }

  addToUserPosts(post: Post): Promise<void> {
    // indexed by postgres
    return Promise.resolve(undefined);
  }

  addUserMessage(msg: Message): Promise<void> {
    // indexed by postgres
    return Promise.resolve(undefined);
  }

  async decrementBlockCount(mod: Moderation): Promise<void> {
    // not tracking block count
    return Promise.resolve(undefined);
  }

  incrementBlockCount(mod: Moderation): Promise<void> {
    // not tracking block count of a post
    return Promise.resolve(undefined);
  }

  async addToThreadModerations(mod: Moderation): Promise<void> {
    const { messageId } = mod.toJSON();
    await this.db.moderations!.createModeration({
      createdAt: mod.createdAt.getTime(),
      creator: mod.creator || '',
      hash: mod.hash(),
      messageId,
      reference: mod.payload.reference,
      subtype: mod.subtype,
      type: MessageType.Moderation,
    });
  }

  async removeFromThreadModerations(mod: Moderation): Promise<void> {
    await this.db.moderations!.remove(mod.hash());
  }

  updateProfile(profile: Profile, key: UserMetaKey): Promise<void> {
    // indexed by postgres
    return Promise.resolve(undefined);
  }

  updateThreadModeration(mod: Moderation): Promise<void> {
    // indexed by postgres
    return Promise.resolve(undefined);
  }

  updateThreadVisibility(mod: Moderation, isRevert?: boolean): Promise<void> {
    // indexed by postgres
    return Promise.resolve(undefined);
  }

  updateUserECDH(profile: Profile): Promise<void> {
    // indexed by postgres
    return Promise.resolve(undefined);
  }

  setLastSync(id: string, type: "address" | "group" | "ecdh" | "thread", time?: Date): Promise<void> {
    // always sync all - not needed
    return Promise.resolve(undefined);
  }

  getLastSync(id: string, type: "address" | "group" | "ecdh" | "thread"): Promise<number> {
    // always sync all - not needed
    return Promise.resolve(0);
  }

  removeFromUserPosts(post: Post): Promise<void> {
    // indexed by postgres
    return Promise.resolve(undefined);
  }

  addChatMessage(chat: Chat): Promise<void> {
    // only used on client-side
    return Promise.resolve(undefined);
  }

  addDirectChatMeta(chat: Chat): Promise<void> {
    // only used on client-side
    return Promise.resolve(undefined);
  }

  saveChatECDH(addressOrIdCommitment: string, ecdh: string): Promise<string> {
    // only used on client side
    return Promise.resolve("");
  }

  getHomefeed(
    filter: Filter,
    limit = -1,
    offset?: number|string
  ): Promise<Post[]> {
    // only used client side
    return Promise.reject('not implemented');
  }

  getChatByECDH(ecdh: string): Promise<ChatMeta[]> {
    // only used client side
    return Promise.resolve([]);
  }

  getChatECDHByUser(addressOrIdCommitment: string): Promise<string[]> {
    // only used client side
    return Promise.resolve([]);
  }

  getChatMessages(chatId: string, limit: number | undefined, offset: number | string | undefined): Promise<Chat[]> {
    // only used client side
    return Promise.resolve([]);
  }

  getChatMeta(ecdh: string, chatId: string): Promise<ChatMeta | null> {
    // only used client side
    return Promise.resolve(null);
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