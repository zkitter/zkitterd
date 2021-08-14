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

            console.log(profile)
            res.send(makeResponse({
                ens: name,
                name: profile.name || name,
                pubkey: user.pubkey,
                bio: profile.bio,
                profileImage: profile.profileImage,
                coverImage: profile.coverImage,
                website: profile.website,
                joinedAt: user.joined,
                meta: {
                    followerCount: 0,
                    followingCount: 0,
                },
            }));
        }));

        this.app.get('/v1/replies', this.wrapHandler(async (req, res) => {
            const limit = req.query.limit && Number(req.query.limit);
            const offset = req.query.offset && Number(req.query.offset);
            const parent = req.query.parent;
            const postDB = await this.call('db', 'getPosts');
            const posts = await postDB.findAllReplies(parent, offset, limit);
            res.send(makeResponse(posts));
        }));

        this.app.get('/v1/posts', this.wrapHandler(async (req, res) => {
            const limit = req.query.limit && Number(req.query.limit);
            const offset = req.query.offset && Number(req.query.offset);
            const creator = req.query.creator && Number(req.query.creator);
            const postDB = await this.call('db', 'getPosts');
            const posts = await postDB.findAllPosts(creator, offset, limit);
            res.send(makeResponse(posts));
        }));

        this.app.post('/dev/semaphore/post', jsonParser, this.wrapHandler(async (req, res) => {
            const json = req.body.post;
            const [creator, hash] = json.messageId.split('/');
            const proof = req.body.proof;
            const publicSignals = req.body.publicSignals;
            const parsedProof = unstringifyBigInts(JSON.parse(proof));
            const parsedPublicSignals = unstringifyBigInts(
                JSON.parse(req.body.publicSignals)
            );
            const [
                root,
                nullifierHash,
                signalHash,
                externalNullifier
            ] = parsedPublicSignals as any;
            const post = new Post({
                ...json,
                creator: creator,
            });
            const verifyingKey = unstringifyBigInts(verificationKey)
            const isProofValid = verifyProof(verifyingKey as any, parsedProof as any, parsedPublicSignals as any);
            const expectedExternalNullifier = genExternalNullifier(hash);
            const expectedSignalHash = await genSignalHash(Buffer.from(hash, 'hex'));
            const isExternalNullifierValid = snarkjs.bigInt(genExternalNullifier(hash)) === externalNullifier;
            const isSignalHashValid = expectedSignalHash === signalHash;
            console.log(root, leaves, nullifierHash, {
                hash,
                signalHash,
                expectedSignalHash,
                expectedExternalNullifier,
                externalNullifier,
                isProofValid,
                isExternalNullifierValid,
                isSignalHashValid,
            })
            res.send();
        }));

        this.app.post('/dev/semaphore', jsonParser, this.wrapHandler(async (req, res) => {
            const identityCommitment = req.body.identityCommitment;
            const index = leaves.indexOf(identityCommitment);

            if (index < 0) {
                tree.update(leaves.length, identityCommitment);
                leaves.push(identityCommitment);
            }

            res.send(index);
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