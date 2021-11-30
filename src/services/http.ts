import {GenericService} from "../util/svc";
import EC from "elliptic";
import express, {Express, Request, Response} from "express";
import bodyParser from "body-parser";
import cors, {CorsOptions} from "cors";
import http from 'http';
import config from "../util/config";
import logger from "../util/logger";
import path from "path";
import {fetchProposal, fetchProposals, fetchSpace, fetchVotes} from "../util/snapshot";
import Web3 from "web3";
const jsonParser = bodyParser.json();
const OAuth = require('oauth-1.0a');
import { getLinkPreview } from "link-preview-js";
import crypto from "crypto";
import queryString from "querystring";
import session from 'express-session';
import jwt from "jsonwebtoken";
import {Dialect, Sequelize} from "sequelize";
import {URLSearchParams} from "url";
const SequelizeStore = require("connect-session-sequelize")(session.Store);
import { calculateReputation, OAuthProvider } from "@interrep/reputation-criteria"
import {getReplies, getUser, showStatus} from "../util/twitter";
import {base64ToArrayBuffer, verifySignatureP256} from "../util/crypto";
import {parseMessageId, PostMessageSubType} from "../util/message";

const corsOptions: CorsOptions = {
    credentials: true,
    origin: function (origin= '', callback) {
        callback(null, true)
    }
};

const TW_REQ_TOKEN_URL = 'https://api.twitter.com/oauth/request_token'
const TW_AUTH_URL = 'https://api.twitter.com/oauth/authenticate'
const TW_ACCESS_TOKEN_URL = 'https://api.twitter.com/oauth/access_token'
const TW_CALLBACK_URL = 'http://127.0.0.1:3000/twitter/callback';
const TW_CONSUMER_KEY = '7LMfRtYmWztFPq4t2RPMROa0Q';
const TW_CONSUMER_SECRET = 'Knsv5ZqWQk37IW6P3RsVCRJ3PvOKnxJTrAmcJ88D4WbgxY7F43';
const JWT_SECRET = process.env.JWT_SECRET || 'topsecret';

const oauth = OAuth({
    consumer: {
        key: TW_CONSUMER_KEY,
        secret: TW_CONSUMER_SECRET,
    },
    signature_method: 'HMAC-SHA1',
    hash_function: (baseString: string, key: string) => {
        return crypto.createHmac('sha1', key).update(baseString).digest('base64')
    },
});

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
            const resp = await fetch(`${config.interrepAPI}/api/groups/${groupId}/${identityCommitment}/path`);
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

            const headers = oauth.toHeader(oauth.authorize({
                url: `https://api.twitter.com/1.1/account/verify_credentials.json`,
                method: 'GET',
            }, {
                key: auth.user_token,
                secret: auth.user_token_secret,
            }));

            // @ts-ignore
            const resp = await fetch(`https://api.twitter.com/1.1/account/verify_credentials.json`, {
                // method: 'POST',
                headers: headers,
            });

            if (resp.status !== 200) {
                res.status(resp.status).send(makeResponse(resp.statusText, true));
                return;
            }

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
            const resp = await fetch(`${config.interrepAPI}/api/groups/${sem.provider}/${sem.name}/${identityCommitment}/path`);
            const json = await resp.json();
            res.send(makeResponse({
                ...json,
                provider: sem.provider,
                name: sem.name,
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
            const requestData = {
                url: TW_REQ_TOKEN_URL,
                method: 'POST',
                data: {
                    oauth_callbank: TW_CALLBACK_URL,
                },
            }

            // @ts-ignore
            const resp = await fetch(requestData.url, {
                method: requestData.method,
                form: requestData.data,
                headers: {
                    ...oauth.toHeader(oauth.authorize(requestData)),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            const text = await resp.text();
            const {
                oauth_token: token,
                oauth_token_secret: tokenSecret,
                oauth_callback_confirmed: callbackConfirmed
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
            const requestData = {
                url: TW_ACCESS_TOKEN_URL,
                method: 'POST',
                data: {
                    oauth_token: token,
                    oauth_verifier: verifier,
                    oauth_token_secret: tokenSecret,
                },
            }

            // @ts-ignore
            const resp = await fetch(requestData.url, {
                method: requestData.method,
                form: requestData.data,
                headers: {
                    ...oauth.toHeader(oauth.authorize(requestData)),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            const text = await resp.text();
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

            // @ts-ignore
            const headers = oauth.toHeader(oauth.authorize({
                url: `https://api.twitter.com/1.1/account/verify_credentials.json`,
                method: 'GET',
            }, {
                key: auth.user_token,
                secret: auth.user_token_secret,
            }));

            // @ts-ignore
            const resp = await fetch(`https://api.twitter.com/1.1/account/verify_credentials.json`, {
                // method: 'POST',
                headers: headers,
            });

            if (resp.status !== 200) {
                res.status(resp.status).send(makeResponse(resp.statusText, true));
                return;
            }

            const json = await resp.json();

            const {
                followers_count,
                verified,
                profile_image_url,
                profile_image_url_https,
                screen_name,
            } = json;
            const reputation = calculateReputation(OAuthProvider.TWITTER, {
                followers: followers_count,
                verifiedProfile: verified,
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

            const requestData = {
                url: `https://api.twitter.com/1.1/statuses/update.json`,
                method: 'POST',
                data: {
                    status,
                    in_reply_to_status_id,
                },
            };
            const headers = oauth.toHeader(oauth.authorize(requestData, {
                key: auth.user_token,
                secret: auth.user_token_secret,
            }));

            // @ts-ignore
            const resp = await fetch(requestData.url, {
                method: requestData.method,
                body: new URLSearchParams(requestData.data).toString(),
                headers: {
                    ...headers,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            const json = await resp.json();

            if (resp.status === 200) {
                res.send(makeResponse(`https://twitter.com/${auth.username}/status/${json.id_str}`));
            } else {
                res.status(resp.status).send(makeResponse(json.errors[0].message, true));
            }
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