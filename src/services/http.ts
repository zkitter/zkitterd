import {GenericService} from "../util/svc";
import express, {Express, Request, Response} from "express";
import bodyParser from "body-parser";
import cors, {CorsOptions} from "cors";
import http from 'http';
import config from "../util/config";
import logger from "../util/logger";
import path from "path";
import {fetchProposal, fetchProposals, fetchSpace, fetchVotes} from "../util/snapshot";
import semaphore from "../models/semaphore";
import Web3 from "web3";
const jsonParser = bodyParser.json();

const corsOptions: CorsOptions = {
    origin: function (origin= '', callback) {
        callback(null, true)
    }
};

const TWITTER_GOLD_HASH = Web3.utils.padRight(Web3.utils.stringToHex('TWITTER_GOLD'), 64);
const TWITTER_SILVER_HASH = Web3.utils.padRight(Web3.utils.stringToHex('TWITTER_SILVER'), 64);
const TWITTER_BRONZE_HASH = Web3.utils.padRight(Web3.utils.stringToHex('TWITTER_BRONZE'), 64);
const TWITTER_NOT_SUFFICIENT_HASH = Web3.utils.padRight(Web3.utils.stringToHex('TWITTER_NOT_SUFFICIENT'), 64);
const REDDIT_GOLD_HASH = Web3.utils.padRight(Web3.utils.stringToHex('REDDIT_GOLD'), 64);
const REDDIT_SILVER_HASH = Web3.utils.padRight(Web3.utils.stringToHex('REDDIT_SILVER'), 64);
const REDDIT_BRONZE_HASH = Web3.utils.padRight(Web3.utils.stringToHex('REDDIT_BRONZE'), 64);
const REDDIT_NOT_SUFFICIENT_HASH = Web3.utils.padRight(Web3.utils.stringToHex('REDDIT_NOT_SUFFICIENT'), 64);
const GITHUB_GOLD_HASH = Web3.utils.padRight(Web3.utils.stringToHex('GITHUB_GOLD'), 64);
const GITHUB_SILVER_HASH = Web3.utils.padRight(Web3.utils.stringToHex('GITHUB_SILVER'), 64);
const GITHUB_BRONZE_HASH = Web3.utils.padRight(Web3.utils.stringToHex('GITHUB_BRONZE'), 64);
const GITHUB_NOT_SUFFICIENT_HASH = Web3.utils.padRight(Web3.utils.stringToHex('GITHUB_NOT_SUFFICIENT'), 64);
const HASH_TO_GROUP_ID = {
    [TWITTER_GOLD_HASH]: 'TWITTER_GOLD',
    [TWITTER_SILVER_HASH]: 'TWITTER_SILVER',
    [TWITTER_BRONZE_HASH]: 'TWITTER_BRONZE',
    [TWITTER_NOT_SUFFICIENT_HASH]: 'TWITTER_NOT_SUFFICIENT',
    [REDDIT_GOLD_HASH]: 'REDDIT_GOLD',
    [REDDIT_SILVER_HASH]: 'REDDIT_SILVER',
    [REDDIT_BRONZE_HASH]: 'REDDIT_BRONZE',
    [REDDIT_NOT_SUFFICIENT_HASH]: 'REDDIT_NOT_SUFFICIENT',
    [GITHUB_GOLD_HASH]: 'GITHUB_GOLD',
    [GITHUB_SILVER_HASH]: 'GITHUB_SILVER',
    [GITHUB_BRONZE_HASH]: 'GITHUB_BRONZE',
    [GITHUB_NOT_SUFFICIENT_HASH]: 'GITHUB_NOT_SUFFICIENT',
};

function makeResponse(payload: any, error?: boolean) {
    return {
        payload,
        error,
    };
}

export default class HttpService extends GenericService {
    app: Express;

    constructor() {
        super();
        this.app = express();
        this.app.use(cors(corsOptions));
        this.app.use('/dev/semaphore_wasm', express.static(path.join(process.cwd(), 'static', 'semaphore.wasm')));
        this.app.use('/dev/semaphore_final_zkey', express.static(path.join(process.cwd(), 'static', 'semaphore_final.zkey')));
        this.app.use('/dev/semaphore_vkey', express.static(path.join(process.cwd(), 'static', 'verification_key.json')));
        this.addRoutes();
    }

    wrapHandler(handler: (req: Request, res: Response) => Promise<void>) {
        return async (req: Request, res: Response) => {
            logger.info('received request', {
                url: req.url,
            });

            try {
                await handler(req, res);
                logger.info('handled request', {
                    url: req.url,
                });
            } catch (e) {
                console.log(e)
                logger.info('error handling request', {
                    message: e.message,
                    url: req.url,
                });

                res.status(500).send({
                    payload: e.message,
                    error: true,
                });
            }
        }
    }

    addRoutes() {
        this.app.get('/healthcheck', this.wrapHandler(async (req, res) => {
            res.send(makeResponse('ok'));
        }));

        this.app.get('/v1/users', this.wrapHandler(async (req, res) => {
            const limit = req.query.limit && Number(req.query.limit);
            const offset = req.query.offset && Number(req.query.offset);
            const context = req.header('x-contextual-name') || undefined;
            const usersDB = await this.call('db', 'getUsers');
            const users = await usersDB.readAll(context, offset, limit);
            const payload = [];

            for (const user of users) {
                const space = await fetchSpace(user.ens);
                payload.push({
                    ...user,
                    snapshotSpace: space,
                });
            }

            res.send(makeResponse(payload));
        }));

        this.app.get('/v1/users/search/:query?', this.wrapHandler(async (req, res) => {
            const limit = req.query.limit && Number(req.query.limit);
            const offset = req.query.offset && Number(req.query.offset);
            const query = req.params.query;
            const context = req.header('x-contextual-name') || undefined;
            const usersDB = await this.call('db', 'getUsers');
            const users = await usersDB.search(query || '', context, offset, limit);
            const payload = [];

            // for (const user of users) {
            //     const space = await fetchSpace(user.ens);
            //     payload.push({
            //         ...user,
            //         snapshotSpace: space,
            //     });
            // }

            res.send(makeResponse(users));
        }));

        this.app.get('/v1/users/:name', this.wrapHandler(async (req, res) => {
            const name = req.params.name;
            const context = req.header('x-contextual-name') || undefined;
            const usersDB = await this.call('db', 'getUsers');
            const user = await usersDB.findOneByName(name, context);
            const space = await fetchSpace(name);
            res.send(makeResponse({
                ...user,
                ens: name,
                snapshotSpace: space,
            }));
        }));

        this.app.get('/v1/snapshot-proposals', this.wrapHandler(async (req, res) => {
            const limit = req.query.limit ? Number(req.query.limit) : undefined;
            const offset = req.query.offset ? Number(req.query.offset) : undefined;
            const creator = req.query.creator as string;
            const context = req.header('x-contextual-name') || undefined;
            const proposals = await fetchProposals(creator, offset, limit);
            const db = await this.call('db', 'getProposalMeta');
            const metaDB = await this.call('db', 'getMeta');
            const scores = await db.getProposalMetas(proposals.map(p => p.id));
            const metas = await metaDB.findMany(
                proposals.map(p => `https://snapshot.org/#/${p.space.id}/proposal/${p.id}`),
                context,
            );
            const result: any = [];

            proposals.forEach((proposal, i) => {
                const ref = `https://snapshot.org/#/${proposal.space.id}/proposal/${proposal.id}`;
                result.push({
                    ...proposal,
                    meta: {
                        scores: scores[proposal.id],
                        ...metas[ref],
                    },
                });
            })

            res.send(makeResponse(result));
        }));

        this.app.get('/v1/snapshot-proposal/:proposalId', this.wrapHandler(async (req, res) => {
            const proposalId = req.params.proposalId as string;
            const context = req.header('x-contextual-name') || undefined;
            const db = await this.call('db', 'getProposalMeta');
            const metaDB = await this.call('db', 'getMeta');
            const scores = await db.getProposalMeta(proposalId);
            const {data} = await fetchProposal(proposalId);
            const ref = `https://snapshot.org/#/${data.proposal.space.id}/proposal/${data.proposal.id}`;
            const meta = await metaDB.findOne(ref, context);
            res.send(makeResponse({
                ...data.proposal,
                meta: {
                    scores: scores,
                    ...meta,
                },
            }));
        }));

        this.app.get('/v1/snapshot-votes/:proposalId', this.wrapHandler(async (req, res) => {
            const proposalId = req.params.proposalId as string;
            const db = await this.call('db', 'getProposalMeta');

            const savedData = await db.getProposalMeta(proposalId);

            if (savedData.length) {
                res.send(makeResponse(savedData));
                return;
            }

            const {data} = await fetchProposal(proposalId, true);
            const votes = await fetchVotes(data.proposal, data.votes);

            if (data.proposal.state === 'closed' && data.proposal.end < (Date.now() / 1000)) {
                for (let i = 0; i < votes.length; i++) {
                    const vote = votes[i];
                    try {
                        await db.createProposalMeta({
                            proposal_id: proposalId,
                            space_id: data.proposal.space.id,
                            choice: i,
                            score: vote,
                        });
                    } catch (e) {
                        logger.error(e.message, e);
                    }
                }
            }

            res.send(makeResponse(votes));
        }));

        this.app.get('/v1/replies', this.wrapHandler(async (req, res) => {
            const limit = req.query.limit && Number(req.query.limit);
            const offset = req.query.offset && Number(req.query.offset);
            const parent = req.query.parent;
            const context = req.header('x-contextual-name') || undefined;
            const postDB = await this.call('db', 'getPosts');
            const posts = await postDB.findAllReplies(parent, context, offset, limit);
            res.send(makeResponse(posts));
        }));

        this.app.get('/v1/posts', this.wrapHandler(async (req, res) => {
            const limit = req.query.limit && Number(req.query.limit);
            const offset = req.query.offset && Number(req.query.offset);
            const creator = req.query.creator;
            const context = req.header('x-contextual-name') || undefined;
            const postDB = await this.call('db', 'getPosts');
            const posts = await postDB.findAllPosts(creator, context, offset, limit);
            res.send(makeResponse(posts));
        }));

        this.app.get('/v1/tags/:tagName', this.wrapHandler(async (req, res) => {
            const limit = req.query.limit && Number(req.query.limit);
            const offset = req.query.offset && Number(req.query.offset);
            const tagName = req.params.tagName;
            const context = req.header('x-contextual-name') || undefined;
            const tagDB = await this.call('db', 'getTags');
            const posts = await tagDB.getPostsByTag(tagName, context, offset, limit);
            res.send(makeResponse(posts));
        }));

        this.app.get('/v1/tags', this.wrapHandler(async (req, res) => {
            const limit = req.query.limit && Number(req.query.limit);
            const offset = req.query.offset && Number(req.query.offset);
            const db = await this.call('db', 'getMeta');
            const tags = await db.findTags(offset, limit);
            res.send(makeResponse(tags));
        }));

        this.app.get('/v1/:creator/replies', this.wrapHandler(async (req, res) => {
            const limit = req.query.limit && Number(req.query.limit);
            const offset = req.query.offset && Number(req.query.offset);
            const creator = req.params.creator;
            const context = req.header('x-contextual-name') || undefined;
            const postDB = await this.call('db', 'getPosts');
            const posts = await postDB.findAllRepliesFromCreator(creator, context, offset, limit);
            res.send(makeResponse(posts));
        }));

        this.app.get('/v1/:creator/likes', this.wrapHandler(async (req, res) => {
            const limit = req.query.limit && Number(req.query.limit);
            const offset = req.query.offset && Number(req.query.offset);
            const creator = req.params.creator;
            const context = req.header('x-contextual-name') || undefined;
            const postDB = await this.call('db', 'getPosts');
            const posts = await postDB.findAllLikedPostsByCreator(creator, context, offset, limit);
            res.send(makeResponse(posts));
        }));

        this.app.get('/v1/homefeed', this.wrapHandler(async (req, res) => {
            const limit = req.query.limit && Number(req.query.limit);
            const offset = req.query.offset && Number(req.query.offset);
            const context = req.header('x-contextual-name') || undefined;
            const postDB = await this.call('db', 'getPosts');
            const posts = await postDB.getHomeFeed(context, offset, limit);
            res.send(makeResponse(posts));
        }));


        this.app.get('/v1/post/:hash', this.wrapHandler(async (req, res) => {
            const hash = req.params.hash;
            const context = req.header('x-contextual-name') || undefined;
            const postDB = await this.call('db', 'getPosts');
            const post = await postDB.findOne(hash, context);
            res.send(makeResponse(post));
        }));

        this.app.post('/dev/semaphore', jsonParser, this.wrapHandler(async (req, res) => {
            const identityCommitment = req.body.identityCommitment;

            const semaphoreDB = await this.call('db', 'getSemaphore');
            const path = await semaphoreDB.addID(identityCommitment);
            res.send(path);
        }));

        this.app.get('/interrep/groups/:groupId/path/:identityCommitment', jsonParser, this.wrapHandler(async (req, res) => {
            const identityCommitment = req.params.identityCommitment;
            const groupId = req.params.groupId;
            // @ts-ignore
            const resp = await fetch(`${config.interrepAPI}/api/groups/${groupId}/${identityCommitment}/path`);
            const json = await resp.json();

            res.send(makeResponse(json));
        }));

        this.app.get('/interrep/:identityCommitment', jsonParser, this.wrapHandler(async (req, res) => {
            const identityCommitment = req.params.identityCommitment;
            const semaphoreDB = await this.call('db', 'getSemaphore');
            const sem = await semaphoreDB.findOneByCommitment(BigInt(identityCommitment).toString(16));

            if (!sem) {
                res.status(404).send(makeResponse('not found', true));
                return;
            }

            // @ts-ignore
            const resp = await fetch(`${config.interrepAPI}/api/groups/${HASH_TO_GROUP_ID[sem.group_id]}/${identityCommitment}/path`);
            const json = await resp.json();

            res.send(makeResponse(json));
        }));

        this.app.get('/dev/semaphore/:identityCommitment', jsonParser, this.wrapHandler(async (req, res) => {
            const identityCommitment = req.params.identityCommitment;
            const semaphoreDB = await this.call('db', 'getSemaphore');
            const path = await semaphoreDB.getPathByID(identityCommitment);
            res.send(makeResponse(path));
        }));
    }

    async start() {
        const httpServer = http.createServer(this.app);
        httpServer.listen(config.port);
        logger.info(`api server listening at ${config.port}...`);
    }
}