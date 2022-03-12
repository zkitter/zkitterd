import {GenericService} from "../util/svc";
import EC from "elliptic";
import express, {Express, Request, Response} from "express";
import bodyParser from "body-parser";
import cors, {CorsOptions} from "cors";
import http from 'http';
import config from "../util/config";
import logger from "../util/logger";
import path from "path";
import {fetchProposal, fetchProposals, fetchVotes} from "../util/snapshot";
import Web3 from "web3";
const jsonParser = bodyParser.json();
import { getLinkPreview } from "link-preview-js";
import queryString from "querystring";
import session from 'express-session';
import jwt from "jsonwebtoken";
import {Dialect, Sequelize} from "sequelize";
const SequelizeStore = require("connect-session-sequelize")(session.Store);
import { calculateReputation, OAuthProvider } from "@interep/reputation";
import {
    accessToken,
    createHeader, getBotometerScore,
    getReplies,
    getUser,
    requestToken,
    showStatus,
    TW_AUTH_URL, updateStatus,
    verifyCredential
} from "../util/twitter";
import {verifySignatureP256} from "../util/crypto";
import {parseMessageId, PostMessageSubType} from "../util/message";

const corsOptions: CorsOptions = {
    credentials: true,
    origin: function (origin= '', callback) {
        callback(null, true)
    }
};

const JWT_SECRET = config.jwtSecret;

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
        this.app.set('trust proxy', 1);
        this.app.use(cors(corsOptions));

        const sequelize = new Sequelize(
            config.dbName as string,
            config.dbUsername as string,
            config.dbPassword,
            {
                host: config.dbHost,
                port: Number(config.dbPort),
                dialect: config.dbDialect as Dialect,
                logging: false,
            },
        );

        const sessionStore = new SequelizeStore({
            db: sequelize,
        })

        this.app.use(session({
            proxy: true,
            secret: 'autistic cat',
            resave: false,
            saveUninitialized: false,
            store: sessionStore,
            cookie: {
                secure: false,
                maxAge: 30 * 24 * 60 * 60 * 1000,
            },
        }));

        sessionStore.sync();

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

            const result = [];

            for (let user of users) {
                const ens = await this.call('ens', 'fetchNameByAddress', user.username);
                result.push({ ens, ...user });
            }

            res.send(makeResponse(result));
        }));

        this.app.get('/v1/users/search/:query?', this.wrapHandler(async (req, res) => {
            const limit = req.query.limit && Number(req.query.limit);
            const offset = req.query.offset && Number(req.query.offset);
            const query = req.params.query;
            const context = req.header('x-contextual-name') || undefined;
            const usersDB = await this.call('db', 'getUsers');
            const users = await usersDB.search(query || '', context, offset, limit);
            const result = [];

            for (let user of users) {
                const ens = await this.call('ens', 'fetchNameByAddress', user.username);
                result.push({ ens, ...user });
            }

            res.send(makeResponse(result));
        }));

        this.app.get('/v1/users/:address', this.wrapHandler(async (req, res) => {
            const usersDB = await this.call('db', 'getUsers');

            let address = req.params.address;

            try {
                address = Web3.utils.toChecksumAddress(address);
            } catch (e) {}

            if (!Web3.utils.isAddress(address)) {
                address = await this.call('ens', 'fetchAddressByName', address);
            }

            const context = req.header('x-contextual-name') || undefined;
            const user = await usersDB.findOneByName(address, context);
            const ens = await this.call('ens', 'fetchNameByAddress', address);
            res.send(makeResponse({
                ...user,
                ens: ens,
                address: address,
                username: address,
            }));
        }));

        this.app.post('/v1/users', jsonParser, this.wrapHandler(async (req, res) => {
            const {
                account,
                publicKey,
                proof,
            } = req.body;

            if (!account || !Web3.utils.isAddress(account)) {
                res.status(400).send(makeResponse('invalid account'));
                return;
            }

            if (!publicKey) {
                res.status(400).send(makeResponse('invalid publicKey'));
                return;
            }

            if (!proof) {
                res.status(400).send(makeResponse('invalid proof'));
                return;
            }

            const pubkeyBytes = Web3.utils.utf8ToHex(publicKey);
            const nonce = await this.call('arbitrum', 'getNonce', account);
            const hash = Web3.utils.keccak256(Web3.utils.encodePacked(account, pubkeyBytes, nonce)!);
            const recover = await this.call('ens', 'ecrecover', hash, proof);

            if (recover !== account) {
                throw new Error('invalid signature');
            }

            const tx = await this.call('arbitrum', 'updateFor', account, publicKey, proof);

            res.send(makeResponse(tx));
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
            const {hash} = parseMessageId(parent as string);
            const context = req.header('x-contextual-name') || undefined;
            const postDB = await this.call('db', 'getPosts');
            const parentPost = await postDB.findOne(hash, context);

            let tweetId;

            if (parentPost?.subtype === PostMessageSubType.MirrorPost) {
                const tweetUrl = parentPost.payload.topic;
                const [__, _, id] = tweetUrl
                    .replace('https://twitter.com/', '')
                    .split('/');
                tweetId = id;
                const lastTweet = await postDB.findLastTweetInConversation(id);
                const tweets = await getReplies(tweetUrl, lastTweet?.hash);
                await postDB.createTwitterPosts(tweets);
            }

            const posts = await postDB.findAllReplies(parent, context, offset, limit, 'ASC', tweetId);
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

        this.app.get('/interrep/groups/:groupId/path/:identityCommitment', jsonParser, this.wrapHandler(async (req, res) => {
            const identityCommitment = req.params.identityCommitment;
            const groupId = req.params.groupId;
            // @ts-ignore
            const resp = await fetch(`${config.interrepAPI}/api/v1/groups/${groupId}/${identityCommitment}/path`);
            const json = await resp.json();

            res.send(makeResponse(json));
        }));

        this.app.post('/interrep/groups/:provider/:name/:identityCommitment', jsonParser, this.wrapHandler(async (req, res) => {
            const identityCommitment = req.params.identityCommitment;
            const provider = req.params.provider;
            const name = req.params.name;

            // @ts-ignore
            const { twitterToken } = req.session;
            const jwtData: any = await jwt.verify(twitterToken, JWT_SECRET);
            const twitterAuthDB = await this.call('db', 'getTwitterAuth');
            const auth = await twitterAuthDB.findUserByToken(jwtData?.userToken);

            const headers = createHeader({
                url: `https://api.twitter.com/1.1/account/verify_credentials.json`,
                method: 'GET',
            }, auth.user_token, auth.user_token_secret);

            // @ts-ignore
            const resp = await fetch(`${config.interrepAPI}/api/v1/groups/${provider}/${name}/${identityCommitment}`, {
                method: 'POST',
                headers: headers,
            });

            if (resp.status !== 201) {
                res.status(resp.status).send(makeResponse(resp.statusText, true));
                return;
            }

            const json = await resp.json();

            res.send(makeResponse(json));
        }));

        this.app.get('/interrep/:identityCommitment', jsonParser, this.wrapHandler(async (req, res) => {
            const identityCommitment = req.params.identityCommitment;
            const semaphoreDB = await this.call('db', 'getSemaphore');
            const exist = await semaphoreDB.findOneByCommitment(identityCommitment);

            if (!exist || exist?.updatedAt.getTime() + 15 * 60 * 1000 > Date.now()) {
                await this.call('interrep', 'scanIDCommitment', identityCommitment);
            }

            const sem = await semaphoreDB.findAllByCommitment(identityCommitment);
            const [group] = sem;

            if (!group) {
                res.status(404).send(makeResponse('not found', true));
                return;
            }
            // @ts-ignore
            const resp = await fetch(`${config.interrepAPI}/api/v1/groups/${group.provider}/${group.name}/${identityCommitment}/proof`);
            const json = await resp.json();
            res.send(makeResponse({
                ...json,
                provider: group.provider,
                name: group.name,
            }));
        }));

        this.app.get('/preview', this.wrapHandler(async (req, res) => {
            const linkDB = await this.call('db', 'getLinkPreview');

            if (typeof req.query.link !== 'string') {
                res.status(400).send(makeResponse(`link must be present in query string.`, true));
                return;
            }

            const url = decodeURI(req.query.link);

            const model = await linkDB.read(url);

            if (model && model.updatedAt.getTime() + (1000 * 60 * 60 * 24) > new Date().getTime()) {
                res.send(makeResponse(model));
                return;
            }

            const preview: any = await getLinkPreview(url);
            const data = {
                link: preview.url,
                mediaType: preview.mediaType || '',
                contentType: preview.contentType || '',
                title: preview.title || '',
                description: preview.description || '',
                image: preview.images[0] || '',
                favicon: preview.favicon || '',
            };

            await linkDB.update(data);
            res.send(makeResponse(data));
        }));

        this.app.get('/twitter', this.wrapHandler(async (req, res) => {
            const text = await requestToken();
            const {
                oauth_token: token,
                oauth_token_secret: tokenSecret,
            } = queryString.parse(text);

            // @ts-ignore
            req.session.tokenSecret = tokenSecret;
            // @ts-ignore
            req.session.redirectUrl = req.query.redirectUrl;
            res.send(makeResponse(`${TW_AUTH_URL}?${queryString.stringify({ oauth_token: token })}`));
        }));

        this.app.get('/twitter/callback', this.wrapHandler(async (req, res) => {
            // @ts-ignore
            const {
                oauth_token: token,
                oauth_verifier: verifier
            } = req.query;
            // @ts-ignore
            const tokenSecret = req.session.tokenSecret;
            // @ts-ignore
            delete req.session.tokenSecret

            const text = await accessToken(token as string, verifier as string, tokenSecret);
            const {
                oauth_token: userToken,
                oauth_token_secret: userTokenSecret,
                screen_name: userName,
                user_id: userId
            } = queryString.parse(text);

            if (!userToken || !userTokenSecret || !userName || !userId) {
                throw new Error('invalid oauth');
            }

            const twitterAuthDB = await this.call('db', 'getTwitterAuth');
            await twitterAuthDB.updateUserToken({
                userToken,
                userTokenSecret,
                userName,
                userId,
            });

            const twitterToken = jwt.sign({ userToken }, JWT_SECRET);

            // @ts-ignore
            req.session.twitterToken = twitterToken;

            // @ts-ignore
            const redirectUrl = req.session.redirectUrl;
            // @ts-ignore
            delete req.session.redirectUrl
            res.redirect(redirectUrl);
        }));

        this.app.get('/twitter/session', this.wrapHandler(async (req, res) => {
            // @ts-ignore
            const { twitterToken } = req.session;
            const signature = req.header('X-SIGNED-ADDRESS');
            const twitterAuthDB = await this.call('db', 'getTwitterAuth');
            const userDB = await this.call('db', 'getUsers');

            let token, secret, auth;

            if (signature) {
                const [sig, address] = signature.split('.');
                const user = await userDB.findOneByName(address);

                if (user?.pubkey) {
                   if (verifySignatureP256(user.pubkey, address, sig)) {
                       const sigAuth = await twitterAuthDB.findUserByAccount(address);

                       if (sigAuth) {
                           auth = sigAuth;
                           const twitterToken = jwt.sign({
                               userToken: auth.user_token,
                           }, JWT_SECRET);

                           // @ts-ignore
                           req.session.twitterToken = twitterToken;
                       }
                   }
                }
            }

            if (!auth) {
                const jwtData: any = await jwt.verify(twitterToken, JWT_SECRET);
                auth = await twitterAuthDB.findUserByToken(jwtData?.userToken);
            }

            const json = await verifyCredential(auth.user_token, auth.user_token_secret);

            const {
                followers_count,
                verified,
                profile_image_url,
                profile_image_url_https,
                screen_name,
            } = json;

            const botometerResult = await getBotometerScore(screen_name)

            const reputation = calculateReputation(OAuthProvider.TWITTER, {
                followers: followers_count,
                verifiedProfile: verified,
                botometerOverallScore: botometerResult?.display_scores?.universal?.overall,
            })

            res.send(makeResponse({
                user_id: auth.user_id,
                user_token: auth.user_token,
                user_token_secret: auth.user_token_secret,
                username: auth.username,
                followers: followers_count,
                verifiedProfile: verified,
                profileImageUrl: profile_image_url,
                profileImageUrlHttps: profile_image_url_https,
                screenName: screen_name,
                reputation,
            }));
        }));

        this.app.get('/twitter/check', this.wrapHandler(async (req, res) => {
            const { username } = req.query;
            const twitterAuthDB = await this.call('db', 'getTwitterAuth');
            const user = await twitterAuthDB.findUserByUsername(username);
            res.send(makeResponse(user));
        }));

        this.app.get('/twitter/user/:username', this.wrapHandler(async (req, res) => {
            const { username } = req.params;
            const user = await getUser(username);
            res.send(makeResponse(user));
        }));

        this.app.post('/twitter/update', jsonParser, this.wrapHandler(async (req, res) => {
            // @ts-ignore
            const { twitterToken } = req.session;
            const { status, in_reply_to_status_id } = req.body;
            const jwtData: any = await jwt.verify(twitterToken, JWT_SECRET);
            const twitterAuthDB = await this.call('db', 'getTwitterAuth');
            const auth = await twitterAuthDB.findUserByToken(jwtData?.userToken);
            const json = await updateStatus(status, in_reply_to_status_id, auth.user_token, auth.user_token_secret);
            res.send(makeResponse(`https://twitter.com/${auth.username}/status/${json.id_str}`));
        }));

        this.app.get('/twitter/status', this.wrapHandler(async(req, res) => {
            // @ts-ignore
            const { id } = req.query;
            const status = await showStatus(id as string);
            res.send(makeResponse(status));
        }))

        this.app.get('/oauth/reset', this.wrapHandler(async (req, res) => {
            // @ts-ignore
            if (req.session.twitterToken) delete req.session.twitterToken;
            res.send(makeResponse('ok'));
        }));
    }

    async start() {
        const httpServer = http.createServer(this.app);
        httpServer.listen(config.port);
        logger.info(`api server listening at ${config.port}...`);
    }
}