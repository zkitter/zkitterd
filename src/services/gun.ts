import {GenericService} from "../util/svc";
import Gun from "gun";
import {IGunChainReference} from "gun/types/chain";
import express from "express";
import config from "../util/config";
import logger from "../util/logger";
import {Message, MessageType, Moderation, Post, PostMessageSubType} from "../util/message";

const Graph = require("gun/src/graph");
const State = require("gun/src/state");

export default class GunService extends GenericService {
    gun?: IGunChainReference;

    watch = async (pubkey: string) => {
        if (!this.gun) throw new Error('gun is not set up');

        const users = await this.call('db', 'getUsers');
        const postDB = await this.call('db', 'getPosts');
        const metaDB = await this.call('db', 'getMeta');
        const user = await users.findOneByPubkey(pubkey);

        if (!user) throw new Error(`cannot find user with pubkey ${pubkey}`);

        this.gun.user(pubkey)
            .get('message')
            .map(async (data: any, messageId: string) => {
                const type = Message.getType(data.type);
                const [creator, hash] = messageId.split('/');

                let payload;

                if (!type) return;

                if (creator !== user.name) return;

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
                        await this.insertPost(post);
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
                }
            });
    }

    async insertPost(post: Post) {
        const json = await post.toJSON();
        const {
            type,
            subtype,
            createdAt,
            payload,
            messageId,
        } = json;
        const [creator, hash] = messageId.split('/');

        const postDB = await this.call('db', 'getPosts');
        const metaDB = await this.call('db', 'getMeta');

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

        try {
            await postDB.createPost({
                hash: hash,
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
                if (subtype === PostMessageSubType.Reply) {
                    await metaDB.addReply(payload.reference.split('/')[1]);
                }

                if (subtype === PostMessageSubType.Repost) {
                    await metaDB.addRepost(payload.reference.split('/')[1]);
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
        const post = await postDB.findOne(payload.reference);

        if (result) {
            logger.debug('moderation already exist', {
                origin: 'gun',
                messageId,
            });
            return;
        }

        try {
            await moderationDB.createModeration({
                hash: hash,
                type: type,
                subtype: subtype,
                creator: creator,
                createdAt: createdAt,
                reference: payload.reference,
            });

            if (payload.reference) {
                await metaDB.addLike(payload.reference.split('/')[1]);
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

    async start() {
        const app = express();
        const server = app.listen(config.gunPort);
        const ctx = this;

        const gun = Gun({
            file: './gun_data',
            web: server,
            peers: [],
        });

        // @ts-ignore
        gun.on('put', async function (msg: any) {
            logger.info('received PUT', { origin: 'gun' });
            // @ts-ignore
            this.to.next(msg);

            try {
                const put = msg.put;
                const soul = put['#'];
                const field = put['.'];
                const state = put['>'];
                const value =  put[':'];

                const [raw, key, name, messageId] = soul.split('/');
                const pubKey = raw.slice(1);

                // if (key && key !== 'message') {
                //     throw new Error(`invalid data key ${key}`);
                // }

                const recordDB = await ctx.call('db', 'getRecords');
                const userDB = await ctx.call('db', 'getUsers');

                const user = await userDB.findOneByPubkey(pubKey);

                if (!user) {
                    throw new Error(`cannot find user with pubkey ${pubKey}`);
                }

                if (name && user.name !== name) {
                    throw new Error(`${user.name} does not match ${name}`);
                }

                await recordDB.updateOrCreateRecord({
                    soul,
                    field,
                    state,
                    value,
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

        // @ts-ignore
        gun.on('get', async function (msg: any) {
            // @ts-ignore
            this.to.next(msg);
            // Extract soul from message
            const soul = msg.get['#'];
            const field = msg.get['.'];
            logger.info('received GET', { origin: 'gun', soul, field });

            try {
                const recordDB = await ctx.call('db', 'getRecords');
                let node;

                if (field) {
                    const record = await recordDB.findOne(soul, field);

                    if (!record) throw new Error(`no record found`);

                    const { state, value } = record;
                    node = State.ify(node, record.field, state, value, soul);
                    node = State.to(node, field);
                    node = Graph.node(node);
                } else {
                    const records = await recordDB.findAll(soul);
                    for (let record of records) {
                        const { state, value } = record;
                        node = State.ify(node, record.field, state, value, soul);
                    }
                }

                logger.info('handled GET', {
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

        // @ts-ignore
        this.gun = gun;

        logger.info(`gun server listening at ${config.gunPort}...`);
    }
}