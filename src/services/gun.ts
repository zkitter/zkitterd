import {GenericService} from "../util/svc";
import Gun from "gun";
import {IGunChainReference} from "gun/types/chain";
import express from "express";
import config from "../util/config";
import logger from "../util/logger";
import {
    Connection,
    ConnectionMessageSubType,
    Message,
    MessageType,
    Moderation, ModerationMessageSubType, parseMessageId,
    Post,
    PostMessageSubType,
    Profile, ProfileMessageSubType
} from "../util/message";
import {Mutex} from "async-mutex";
import {UserModel} from "../models/users";
import {HASHTAG_REGEX, MENTION_REGEX} from "../util/regex";
import vKey from "../../static/verification_key.json";
import {showStatus} from "../util/twitter";
import {Semaphore} from "@zk-kit/protocols";

const Graph = require("../../lib/gun/graph.js");
const State = require("../../lib/gun/state.js");
const Val = require("../../lib/gun/val.js");

const getMutex = new Mutex();
const putMutex = new Mutex();
const insertMutex = new Mutex();

export default class GunService extends GenericService {
    gun?: IGunChainReference;

    watchGlobal = async () => {
        if (!this.gun) throw new Error('gun is not set up');

        this.gun.get('message')
            .map(async (data, messageId) => {
                try {
                    await this.handleGunMessage(data, messageId);
                } catch (e) {
                    logger.error(e.message, e);
                }
            });
    }

    watch = async (pubkey: string) => {
        if (!this.gun) throw new Error('gun is not set up');

        // const users = await this.call('db', 'getUsers');
        // const user = await users.findOneByPubkey(pubkey);
        //
        // if (!user) throw new Error(`cannot find user with pubkey ${pubkey}`);

        this.gun.user(pubkey)
            .get('message')
            .map(async (data, messageId) => {
                try {
                    await this.handleGunMessage(data, messageId, pubkey);
                } catch (e) {
                    logger.error(e.message, e);
                }
            });
    }

    handleGunMessage = async (data: any, messageId: string, pubkey?: string) => {
        return insertMutex.runExclusive(async () => {
            const {creator, hash} = parseMessageId(messageId);

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

            if(data.payload) {
                // @ts-ignore
                payload = await this.gun.get(data.payload['#']);
            }

            switch (type) {
                case MessageType.Post:
                    const post = new Post({
                        type: type,
                        subtype: Post.getSubtype(data.subtype),
                        creator: creator,
                        createdAt: new Date(Number(data.createdAt)),
                        payload: {
                            topic: payload.topic,
                            title: payload.title,
                            content: payload.content,
                            reference: payload.reference,
                            attachment: payload.attachment,
                        },
                    });
                    await this.insertPost(
                        post,
                        !data.proof ? undefined : {
                            proof: data.proof,
                            publicSignals: data.publicSignals,
                            x_share: data.x_share,
                            epoch: data.epoch,
                            group: data.group,
                        },
                    );
                    return;
                case MessageType.Moderation:
                    const moderation = new Moderation({
                        type: type,
                        subtype: Moderation.getSubtype(data.subtype),
                        creator: creator,
                        createdAt: new Date(Number(data.createdAt)),
                        payload: {
                            reference: payload.reference,
                        },
                    });
                    await this.insertModeration(moderation);
                    return;
                case MessageType.Connection:
                    const connection = new Connection({
                        type: type,
                        subtype: Connection.getSubtype(data.subtype),
                        creator: creator,
                        createdAt: new Date(Number(data.createdAt)),
                        payload: {
                            name: payload.name,
                        },
                    });
                    await this.insertConnection(connection);
                    return;
                case MessageType.Profile:
                    const profile = new Profile({
                        type: type,
                        subtype: Profile.getSubtype(data.subtype),
                        creator: creator,
                        createdAt: new Date(Number(data.createdAt)),
                        payload: {
                            key: payload.key,
                            value: payload.value,
                        },
                    });
                    await this.insertProfile(profile);
                    return;
            }
        });
    }

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

        if (msg = await conns.findOne(hash)) {
            switch (msg.subtype) {
                case "FOLLOW":
                    await userMeta.removeFollowing(msg.creator);
                    await userMeta.removeFollower(msg.name);
                    break;
                case "BLOCK":
                    await userMeta.removeBlocking(msg.creator);
                    await userMeta.removeBlocked(msg.name);
                    break;
            }

            await conns.remove(hash);
        }

        else if (msg = await mods.findOne(hash)) {
            switch (msg.subtype) {
                case 'LIKE':
                    await postMeta.removeLike(msg.reference);
                    break;
            }
            await mods.remove(hash);
        }

        else if (msg = await posts.findOne(hash)) {
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
        }

        else if (await pfs.findOne(hash)) {
            await pfs.remove(hash);
        }

    }

    async insertPost(post: Post, data?: {
        proof: string;
        publicSignals: string;
        x_share: string;
        epoch: string;
        group?: string;
    }) {
        const json = await post.toJSON();

        const {
            type,
            subtype,
            createdAt,
            payload,
            messageId,
            hash,
        } = json;

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
                origin: 'gun',
                messageId,
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
                    verified = await Semaphore.verifyProof(
                        vKey as any,
                        {
                            proof,
                            publicSignals,
                        },
                    );

                    if (!verified) return;
                } else {
                    verified = await this.call('zkchat', 'verifyRLNProof', {
                        proof,
                        publicSignals,
                        x_share: data.x_share,
                        epoch: data.epoch,
                    });

                    const share = {
                        nullifier: publicSignals.internalNullifier,
                        epoch: publicSignals.epoch,
                        y_share: publicSignals.yShare,
                        x_share: data.x_share,
                    };

                    const {
                        shares,
                        isSpam,
                        isDuplicate,
                    } = await this.call('zkchat', 'checkShare', share);

                    if (isSpam || isDuplicate || !verified) return;
                }

                const group = await this.call(
                    'merkle',
                    'getGroupByRoot',
                    '0x' + BigInt(publicSignals.merkleRoot).toString(16),
                );

                if (!group) return;

                const [protocol, groupName, groupType] = group.split('_')
                await semaphoreCreatorsDB.addSemaphoreCreator(messageId, groupName, groupType);
            }

            await postDB.createPost({
                messageId: messageId,
                hash: hash,
                proof: data?.proof,
                signals: data?.publicSignals,
                type: type,
                subtype: subtype,
                creator: creator || '',
                createdAt: createdAt,
                topic: payload.topic,
                title: payload.title,
                content: payload.content,
                reference: payload.reference,
                attachment: payload.attachment,
            });

            if (payload.reference) {
                try {
                    // @ts-ignore
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
                origin: 'gun',
                messageId,
            });
        } catch (e) {
            logger.error(`error inserting post`, {
                error: e.message,
                stack: e.stack,
                parent: e.parent,
                origin: 'gun',
                messageId,
            });
        }
    }

    async insertModeration(moderation: Moderation) {
        const json = await moderation.toJSON();
        const {
            type,
            subtype,
            createdAt,
            payload,
            messageId,
        } = json;

        const {creator, hash} = parseMessageId(messageId);

        const moderationDB = await this.call('db', 'getModerations');
        const postDB = await this.call('db', 'getPosts');
        const metaDB = await this.call('db', 'getMeta');

        if (json.hash !== hash) {
            return;
        }

        const result = await moderationDB.findOne(hash);

        if (result) {
            logger.debug('moderation already exist', {
                origin: 'gun',
                messageId,
            });
            return;
        }

        try {
            await postDB.ensurePost(payload.reference);
            await moderationDB.createModeration({
                messageId,
                hash: hash,
                type: type,
                subtype: subtype,
                creator: creator || '',
                createdAt: createdAt,
                reference: payload.reference,
            });

            if (subtype === ModerationMessageSubType.Like && payload.reference) {
                await metaDB.addLike(payload.reference);
            }

            logger.info(`insert moderation`, {
                origin: 'gun',
                messageId,
            });
        } catch (e) {
            logger.error(`error inserting moderation`, {
                error: e.message,
                stack: e.stack,
                parent: e.parent,
                origin: 'gun',
                messageId,
            });
        }
    }

    async insertConnection(connection: Connection) {
        const json = await connection.toJSON();
        const {
            type,
            subtype,
            createdAt,
            payload,
            messageId,
        } = json;
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
                origin: 'gun',
                messageId,
            });
            return;
        }

        try {
            await userDB.ensureUser(payload.name);

            await connDB.createConnection({
                messageId,
                hash: hash,
                type: type,
                subtype: subtype,
                creator: creator || '',
                createdAt: createdAt,
                name: payload.name,
            });

            if (subtype === ConnectionMessageSubType.Follow) {
                await userMetaDB.addFollower(payload.name);
                await userMetaDB.addFollowing(creator);
            } else if (subtype === ConnectionMessageSubType.Block) {
                await userMetaDB.addBlocked(payload.name);
                await userMetaDB.addBlocking(creator);
            }

            logger.info(`insert connection`, {
                origin: 'gun',
                messageId,
            });
        } catch (e) {
            logger.error(`error inserting connection`, {
                error: e.message,
                stack: e.stack,
                parent: e.parent,
                origin: 'gun',
                messageId,
            });
        }
    }

    async insertProfile(profile: Profile) {
        const json = await profile.toJSON();
        const {
            type,
            subtype,
            createdAt,
            payload,
            messageId,
        } = json;
        const {creator, hash} = parseMessageId(messageId);

        const profileDB = await this.call('db', 'getProfiles');
        const twitterAuthDb = await this.call('db', 'getTwitterAuth');

        if (json.hash !== hash) {
            return;
        }

        const result = await profileDB.findOne(hash);

        if (result) {
            logger.debug('profile already exist', {
                origin: 'gun',
                messageId,
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
                    urls: [{
                        expanded_url: profileUrl,
                    }],
                },
                user: {
                    screen_name,
                }
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
                messageId,
                hash: hash,
                type: type,
                subtype: subtype,
                creator: creator,
                createdAt: createdAt,
                key: payload.key,
                value: payload.value,
            });

            logger.info(`insert profile`, {
                origin: 'gun',
                messageId,
            });
        } catch (e) {
            logger.error(`error inserting profile`, {
                error: e.message,
                stack: e.stack,
                parent: e.parent,
                origin: 'gun',
                messageId,
            });
        }
    }

    async start() {
        const app = express();
        const server = app.listen(config.gunPort);
        const ctx = this;
        const gunPath = process.env.NODE_ENV === 'development'
            ? './dev_gun_data'
            : './gun_data';

        const gun = Gun({
            file: gunPath,
            web: server,
            peers: config.gunPeers,
        });

        // @ts-ignore
        gun.on('put', async function (msg: any) {
            return putMutex.runExclusive(async () => {
                // @ts-ignore
                this.to.next(msg);

                try {
                    const put = msg.put;
                    const soul = put['#'];
                    const field = put['.'];
                    const state = put['>'];
                    const value =  put[':'];

                    const [raw, key, username, messageId] = soul.split('/');
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
                        soul,
                        field,
                        state,
                        value: relation ? null : value,
                        relation,
                    });

                    logger.debug('handled PUT', {
                        soul,
                        field,
                        origin: 'gun',
                    });

                    // Send ack back
                    // @ts-ignore
                    gun.on('in', {
                        '@' : msg['@'],
                        ok  : 0,
                    });
                } catch (e) {
                    logger.error('error processing PUT', {
                        error: e.message,
                        parent: e.parent,
                        stack: e.stack,
                        origin: 'gun',
                    });
                }
            });
        });

        // @ts-ignore
        gun.on('get', async function (msg: any) {
            return getMutex.runExclusive(async () => {
                // @ts-ignore
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

                        const { state, value, relation } = record;
                        const val = relation ? Val.rel.ify(relation) : value;
                        node = State.ify(node, record.field, state, val, soul);
                        node = State.to(node, field);
                    } else {
                        const records = await recordDB.findAll(soul);
                        for (let record of records) {
                            const { state, value, relation } = record;
                            const val = relation ? Val.rel.ify(relation) : value;
                            node = State.ify(node, record.field, state, val, soul);
                        }
                    }

                    logger.debug('handled GET', {
                        soul,
                        field,
                        origin: 'gun',
                    });

                    // @ts-ignore
                    gun.on('in', {
                        '@' : msg['#'],
                        put : Graph.node(node),
                    });

                } catch (e) {
                    logger.error('error processing GET', {
                        error: e.message,
                        stack: e.stack,
                        origin: 'gun',
                        soul,
                        field,
                    });
                }
            });
        });

        // @ts-ignore
        this.gun = gun;

        const userDB = await this.call('db', 'getUsers');
        const users = await userDB.readAll('', 0, 100);

        // for (const user of users) {
        //     await this.watch(user.pubkey);
        // }

        await this.watchGlobal();

        logger.info(`gun server listening at ${config.gunPort}...`);
    }

}