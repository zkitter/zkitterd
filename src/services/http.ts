import {GenericService} from "../util/svc";
import express, {Express, Request, Response} from "express";
import bodyParser from "body-parser";
import cors, {CorsOptions} from "cors";
import http from 'http';
import config from "../util/config";
import logger from "../util/logger";
import path from "path";
import {fetchProposal, fetchProposals, fetchSpace, fetchVotes} from "../util/snapshot";
const jsonParser = bodyParser.json();

const corsOptions: CorsOptions = {
    origin: function (origin= '', callback) {
        callback(null, true)
    }
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
        this.app.use('/dev/circuit', express.static(path.join(process.cwd(), 'static', 'circuit.json')));
        this.app.use('/dev/provingKey', express.static(path.join(process.cwd(), 'static', 'proving_key.bin')));
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
            const scores = await db.getProposalMetas(proposals.map(p => p.id));
            const result: any = [];

            proposals.forEach((proposal, i) => {
                result.push({
                    ...proposal,
                    meta: {
                        scores: scores[proposal.id],
                    },
                });
            })

            res.send(makeResponse(result));
        }));

        this.app.get('/v1/snapshot-proposal/:proposalId', this.wrapHandler(async (req, res) => {
            const proposalId = req.params.proposalId as string;
            const context = req.header('x-contextual-name') || undefined;
            const db = await this.call('db', 'getProposalMeta');
            const scores = await db.getProposalMeta(proposalId);
            const {data} = await fetchProposal(proposalId);
            res.send(makeResponse({
                ...data.proposal,
                meta: {
                    scores: scores,
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