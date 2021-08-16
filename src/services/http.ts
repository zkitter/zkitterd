import {GenericService} from "../util/svc";
import express, {Express, Request, Response} from "express";
import bodyParser from "body-parser";
import cors, {CorsOptions} from "cors";
import http from 'http';
import config from "../util/config";
import logger from "../util/logger";
import {
    setupTree,
    genExternalNullifier,
    genSignalHash,
    stringifyBigInts,
    unstringifyBigInts,
    verifyProof
} from "libsemaphore";
const snarkjs = require('snarkjs');
import path from "path";
import verificationKey from "../../static/verification_key.json";
import {Post} from "../util/message";
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

const tree = setupTree(20);
const leaves: string[] = [];
const rootHistory: {[key: string]: boolean} = {};

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
            const usersDB = await this.call('db', 'getUsers');
            const users = await usersDB.readAll(offset, limit);
            res.send(makeResponse(users));
        }));

        this.app.get('/v1/users/:name', this.wrapHandler(async (req, res) => {
            const name = req.params.name;
            const usersDB = await this.call('db', 'getUsers');
            const profilesDB = await this.call('db', 'getProfiles');
            const user = await usersDB.findOneByName(name);
            const profile = await profilesDB.findProfile(name);

            res.send(makeResponse({
                ens: name,
                name: profile.name || name,
                pubkey: user?.pubkey || '',
                bio: profile.bio,
                profileImage: profile.profileImage,
                coverImage: profile.coverImage,
                website: profile.website,
                joinedAt: user?.joined || 0,
                meta: {
                    followerCount: user?.meta?.followerCount || 0,
                    followingCount: user?.meta?.followingCount || 0,
                    blockedCount: user?.meta?.blockedCount || 0,
                    blockingCount: user?.meta?.blockingCount || 0,
                },
            }));
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


        this.app.get('/v1/post/:hash', this.wrapHandler(async (req, res) => {
            const hash = req.params.hash;
            const postDB = await this.call('db', 'getPosts');
            const post = await postDB.findOne(hash);
            res.send(makeResponse(post));
        }));

        this.app.post('/dev/semaphore/post', jsonParser, this.wrapHandler(async (req, res) => {
            const json = req.body.post;
            const proof = req.body.proof;
            const publicSignals = req.body.publicSignals;
            const parsedProof = unstringifyBigInts(JSON.parse(proof));
            const parsedPublicSignals = unstringifyBigInts(
                JSON.parse(publicSignals)
            );
            const [
                root,
                nullifierHash,
                signalHash,
                externalNullifier
            ] = parsedPublicSignals as any;
            const post = new Post({
                ...json,
                createdAt: new Date(json.createdAt),
            });
            const hash = post.hash();
            const verifyingKey = unstringifyBigInts(verificationKey)
            const isProofValid = verifyProof(verifyingKey as any, parsedProof as any, parsedPublicSignals as any);
            const expectedSignalHash = await genSignalHash(Buffer.from(hash, 'hex'));
            const isExternalNullifierValid = snarkjs.bigInt(genExternalNullifier(hash)) === externalNullifier;
            const isSignalHashValid = expectedSignalHash === signalHash;
            // @ts-ignore
            const isInRootHistory = rootHistory[stringifyBigInts(root)];
            console.log({
                isProofValid,
                isExternalNullifierValid,
                isSignalHashValid,
                isInRootHistory,
            })

            if (!isProofValid || !isExternalNullifierValid || !isSignalHashValid || !isInRootHistory) {
                res.status(403).send(makeResponse('invalid semaphore proof', true));
                return;
            }

            const postDB = await this.call('db', 'getPosts');
            await postDB.createPost({
                hash: hash,
                type: json.type,
                subtype: json.subtype,
                creator: '',
                createdAt: json.createdAt,
                topic: json.payload.topic,
                title: json.payload.title,
                content: json.payload.content,
                reference: json.payload.reference,
                attachment: json.payload.attachment,
            });
            res.send(makeResponse('ok'));
        }));

        this.app.post('/dev/semaphore', jsonParser, this.wrapHandler(async (req, res) => {
            const identityCommitment = req.body.identityCommitment;
            const index = leaves.indexOf(identityCommitment);
            let path = null;

            if (index < 0) {
                await tree.update(leaves.length, identityCommitment);
                path = await tree.path(leaves.length);
                leaves.push(identityCommitment);
                rootHistory[path.root] = true;
            }

            res.send(path);
        }));

        this.app.get('/dev/semaphore/:identityCommitment', jsonParser, this.wrapHandler(async (req, res) => {
            const identityCommitment = req.params.identityCommitment;
            const index = leaves.indexOf(identityCommitment);
            let path = null;

            if (index > -1) {
                path = await tree.path(index);
            }

            res.send(makeResponse(path));
        }));
    }

    async start() {
        const httpServer = http.createServer(this.app);
        httpServer.listen(config.port);
        logger.info(`api server listening at ${config.port}...`);
    }
}