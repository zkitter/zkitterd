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
    Moderation,
    Post,
    PostMessageSubType,
    Profile
} from "../util/message";
import {Mutex} from "async-mutex";
import {UserModel} from "../models/users";

const Graph = require("gun/src/graph");
const State = require("gun/src/state");
const Val = require("gun/src/val");

const getMutex = new Mutex();
const putMutex = new Mutex();
const insertMutex = new Mutex();

export default class GunService extends GenericService {
    gun?: IGunChainReference;

    watchGlobal = async () => {
        if (!this.gun) throw new Error('gun is not set up');

        this.gun.get('message')
            .map(async (data, messageId) => this.handleGunMessage(data, messageId));
    }

    watch = async (pubkey: string) => {
        if (!this.gun) throw new Error('gun is not set up');

        const users = await this.call('db', 'getUsers');
        const user = await users.findOneByPubkey(pubkey);

        if (!user) throw new Error(`cannot find user with pubkey ${pubkey}`);

        this.gun.user(pubkey)
            .get('message')
            .map(async (data, messageId) => this.handleGunMessage(data, messageId, user));
    }

    handleGunMessage = async (data: any, messageId: string, user?: UserModel) => {
        return insertMutex.runExclusive(async () => {
            const type = Message.getType(data.type);
            const parsed = messageId.split('/');
            const creator = parsed[1] ? parsed[0] : '';
            const hash = parsed[1] || parsed[0];

            let payload;

            if (!type) return;

            if (creator && (creator !== user?.name)) return;

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
                        createdAt: new Date(data.createdAt),
                        payload: {
                            topic: payload.topic,
                            title: payload.title,
                            content: payload.content,
                            reference: payload.reference,
                            attachment: payload.attachment,
                        },
                    });
                    await this.insertPost(post, data.proof, data.publicSignals);
                    return;
                case MessageType.Moderation:
                    const moderation = new Moderation({
                        type: type,
                        subtype: Moderation.getSubtype(data.subtype),
                        creator: creator,
                        createdAt: new Date(data.createdAt),
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
                        createdAt: new Date(data.createdAt),
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
                        createdAt: new Date(data.createdAt),
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

    async insertPost(post: Post, proof?: string, signals?: string) {
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
        const semaphoreDB = await this.call('db', 'getSemaphore');

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

        if (!creator && (!proof || !signals)) {
            return;
        }

        if (proof && signals) {
            const validProof = await semaphoreDB.validateProof(json.hash, proof, signals);
            if (!validProof) return;
        }

        try {
            await postDB.createPost({
                messageId: messageId,
                hash: hash,
                proof,
                signals,
                type: type,
                subtype: subtype,
                creator: creator,
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
        const [creator, hash] = messageId.split('/');

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
                creator: creator,
                createdAt: createdAt,
                reference: payload.reference,
            });

            if (payload.reference) {
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
                creator: creator,
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
        const [creator, hash] = messageId.split('/');

        const profileDB = await this.call('db', 'getProfiles');

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

                    const [raw, key, name, messageId] = soul.split('/');
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

                        if (name && user.name !== name) {
                            throw new Error(`${user.name} does not match ${name}`);
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
                    });
                }
            });
        });

        // @ts-ignore
        this.gun = gun;

        const userDB = await this.call('db', 'getUsers');
        const users = await userDB.readAll('', 0, 100);

        for (const user of users) {
            await this.watch(user.pubkey);
        }

        await this.watchGlobal();

        logger.info(`gun server listening at ${config.gunPort}...`);
    }

}