import {GenericService} from "../util/svc";
import Gun from "gun";
const Graph = require("gun/src/graph");
const State = require("gun/src/state");
const Node = require("gun/src/node");
import {IGunChainReference} from "gun/types/chain";
import express from "express";
import config from "../util/config";
import logger from "../util/logger";

// @ts-ignore
const rel_ = Gun.val.rel._;  // '#'
// @ts-ignore
const val_ = Gun.obj.has._;  // '.'
// @ts-ignore
const node_ = Gun.node._;  // '_'
// @ts-ignore
const state_ = Gun.state._;// '>';
// @ts-ignore
const soul_ = Gun.node.soul._;// '#';
const ACK_ = '@';
const SEQ_ = '#';

export default class GunService extends GenericService {
    gun?: IGunChainReference;

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

                const recordDB = await ctx.call('db', 'getRecords');
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
                    stack: e.stack,
                    origin: 'gun',
                });
            }
        });

        // @ts-ignore
        gun.on('get', async function (msg: any) {
            logger.info('received GET', { origin: 'gun' });
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
                    const {
                        state,
                        value,
                    } = record;
                    node = State.ify(node, record.field, state, value, soul);
                    node = State.to(node, field);
                    node = Graph.node(node);
                } else {
                    const records = await recordDB.findAll(soul);
                    for (let record of records) {
                        const {
                            state,
                            value,
                        } = record;
                        node = State.ify(node, record.field, state, value, soul);
                    }
                }

                logger.info('handled GET', {
                    soul,
                    field,
                    origin: gun,
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