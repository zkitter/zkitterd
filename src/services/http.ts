import {GenericService} from "../util/svc";
import express, {Express, NextFunction, Request, Response} from "express";
import bodyParser from "body-parser";
import cors, {CorsOptions} from "cors";
import http from 'http';
import config from "../util/config";
import logger from "../util/logger";
import path from "path";
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
import multer from 'multer';
const upload = multer({
    dest: './uploaded_files',
});
import fs from 'fs';
import { getFilesFromPath } from 'web3.storage';
import {UploadModel} from "../models/uploads";
import {genExternalNullifier, Semaphore, SemaphoreFullProof} from "@zk-kit/protocols";
import vKey from "../../static/verification_key.json";

const corsOptions: CorsOptions = {
    credentials: true,
    origin: function (origin= '', callback) {
        callback(null, true)
    }
};

const JWT_SECRET = config.jwtSecret;
const ONE_MB = 1048576;
const maxFileSize = ONE_MB * 5;
const maxPerUserSize = ONE_MB * 100;

function makeResponse(payload: any, error?: boolean) {
    return {
        payload,
        error,
    };
}

export default class HttpService extends GenericService {
    app: Express;
    httpServer: any;

    constructor() {
        super();
        this.app = express();
    }

    verifyAuth = (
        getExternalNullifer: (req: Request) => string | Promise<string>,
        getSignal: (req: Request) => string | Promise<string>,
        onError?: (req: Request) => void | Promise<void>,
    ) => async (req: Request, res: Response, next: NextFunction) => {
        const signature = req.header('X-SIGNED-ADDRESS');
        const semaphoreProof = req.header('X-SEMAPHORE-PROOF');
        const userDB = await this.call('db', 'getUsers');

        if (signature) {
            const params = signature.split('.');
            const user = await userDB.findOneByName(params[1]);
            if (!user || !verifySignatureP256(user.pubkey, params[1], params[0])) {
                res.status(403).send(makeResponse('user must be authenticated', true));
                if (onError) onError(req);
                return;
            }
            // @ts-ignore
            req.username = params[1];
        } else if (semaphoreProof) {
            const { proof, publicSignals } = JSON.parse(semaphoreProof) as SemaphoreFullProof;
            const externalNullifier = await genExternalNullifier(await getExternalNullifer(req));
            const signalHash = await Semaphore.genSignalHash(await getSignal(req));
            const matchNullifier = BigInt(externalNullifier).toString() === publicSignals.externalNullifier;
            const matchSignal = signalHash.toString() === publicSignals.signalHash;
            const hashData = await this.call(
                'interrep',
                'getBatchFromRootHash',
                publicSignals.merkleRoot
            );
            const verified = await Semaphore.verifyProof(
                vKey as any,
                {
                    proof,
                    publicSignals,
                },
            );

            if (!matchNullifier || !matchSignal || !verified || !hashData) {
                res.status(403).send(makeResponse('invalid semaphore proof', true));
                if (onError) onError(req);
                return;
            }

        }

        next();
    }

    wrapHandler(handler: (req: Request, res: Response) => Promise<any>) {
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

    handleGetUser = async (req: Request, res: Response) => {
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
    };

    handleSearchUser = async (req: Request, res: Response) => {
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
    };

    handleGetUserByAddress = async (req: Request, res: Response) => {
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
    };

    handleAddUser = async (req: Request, res: Response) => {
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
    };

    handleGetReplies = async (req: Request, res: Response) => {
        const limit = req.query.limit && Number(req.query.limit);
        const offset = req.query.offset && Number(req.query.offset);
        const parent = req.query.parent;
        const {hash} = parseMessageId(parent as string);
        const context = req.header('x-contextual-name') || undefined;
        const unmoderated = (req.header('x-unmoderated') || '') === 'true';
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

        const posts = await postDB.findAllReplies(parent, context, offset, limit, 'ASC', tweetId, unmoderated);
        res.send(makeResponse(posts));
    };

    handleGetPosts = async (req: Request, res: Response) => {
        const limit = req.query.limit && Number(req.query.limit);
        const offset = req.query.offset && Number(req.query.offset);
        const creator = req.query.creator;
        const context = req.header('x-contextual-name') || undefined;
        const postDB = await this.call('db', 'getPosts');
        const posts = await postDB.findAllPosts(
            creator,
            context,
            offset,
            limit,
            undefined,
            !!creator,
        );
        res.send(makeResponse(posts));
    };

    handleGetPostsByTag = async (req: Request, res: Response) => {
        const limit = req.query.limit && Number(req.query.limit);
        const offset = req.query.offset && Number(req.query.offset);
        const tagName = req.params.tagName;
        const context = req.header('x-contextual-name') || undefined;
        const tagDB = await this.call('db', 'getTags');
        const posts = await tagDB.getPostsByTag(tagName, context, offset, limit);
        res.send(makeResponse(posts));
    };

    handleGetTags = async (req: Request, res: Response) => {
        const limit = req.query.limit && Number(req.query.limit);
        const offset = req.query.offset && Number(req.query.offset);
        const db = await this.call('db', 'getMeta');
        const tags = await db.findTags(offset, limit);
        res.send(makeResponse(tags));
    };

    handleGetUserReplies = async (req: Request, res: Response) => {
        const limit = req.query.limit && Number(req.query.limit);
        const offset = req.query.offset && Number(req.query.offset);
        const creator = req.params.creator;
        const context = req.header('x-contextual-name') || undefined;
        const postDB = await this.call('db', 'getPosts');
        const posts = await postDB.findAllRepliesFromCreator(creator, context, offset, limit);
        res.send(makeResponse(posts));
    };

    handleGetUserLikes = async (req: Request, res: Response) => {
        const limit = req.query.limit && Number(req.query.limit);
        const offset = req.query.offset && Number(req.query.offset);
        const creator = req.params.creator;
        const context = req.header('x-contextual-name') || undefined;
        const postDB = await this.call('db', 'getPosts');
        const posts = await postDB.findAllLikedPostsByCreator(creator, context, offset, limit);
        res.send(makeResponse(posts));
    };

    handleGetHomefeed = async (req: Request, res: Response) => {
        const limit = req.query.limit && Number(req.query.limit);
        const offset = req.query.offset && Number(req.query.offset);
        const context = req.header('x-contextual-name') || undefined;
        const postDB = await this.call('db', 'getPosts');
        const posts = await postDB.getHomeFeed(context, offset, limit);
        res.send(makeResponse(posts));
    };

    handleGetPostByHash = async (req: Request, res: Response) => {
        const hash = req.params.hash;
        const context = req.header('x-contextual-name') || undefined;
        const postDB = await this.call('db', 'getPosts');
        const post = await postDB.findOne(hash, context);
        res.send(makeResponse(post));
    };

    handleGetChatUsers = async (req: Request, res: Response) => {
        const limit = req.query.limit && Number(req.query.limit);
        const offset = req.query.offset && Number(req.query.offset);
        const users = await this.call('zkchat', 'getAllUsers', offset, limit);
        res.send(makeResponse(users));
    };

    handlePostChatMessage = async (req: Request, res: Response) => {
        const {
            messageId,
            type,
            timestamp,
            sender,
            receiver,
            ciphertext,
            rln,
        } = req.body;
        const signature = req.header('X-SIGNED-ADDRESS');
        const userDB = await this.call('db', 'getUsers');

        if (!sender.address && (!sender.hash && !sender.ecdh)) throw new Error('invalid sender');
        if (!receiver.address && !receiver.ecdh) throw new Error('invalid receiver');

        if (rln) {
            if (!sender.hash) throw new Error('invalid request object');

            const isEpochCurrent = await this.call('zkchat', 'isEpochCurrent', rln.epoch)
            const verified = await this.call('zkchat', 'verifyRLNProof', rln)
            const group = await this.call(
                'merkle',
                'getGroupByRoot',
                '0x' + BigInt(rln.publicSignals.merkleRoot).toString(16),
            );

            if (!isEpochCurrent) throw new Error('outdated message');
            if (!verified) throw new Error('invalid rln proof');
            if (!group) throw new Error('invalid merkle root');

            rln.group_id = group;

            const share = {
                nullifier: rln.publicSignals.internalNullifier,
                epoch: rln.publicSignals.epoch,
                y_share: rln.publicSignals.yShare,
                x_share: rln.x_share,
            };

            const {
                shares,
                isSpam,
                isDuplicate,
            } = await this.call('zkchat', 'checkShare', share);

            if (isDuplicate) {
                throw new Error('duplicate message');
            }

            if (isSpam) {
                res.status(429).send('too many requests');
                return;
            }

            await this.call('zkchat', 'insertShare', share)
        } else if (signature) {
            const [sig, address] = signature.split('.');
            const user = await userDB.findOneByName(address);

            if (user?.pubkey) {
                if (!verifySignatureP256(user.pubkey, address, sig)) {
                    res.status(403).send(makeResponse('unauthorized', true));
                    return;
                }
            }
        } else {
            res.status(403).send(makeResponse('unauthorized', true));
            return;
        }

        const data = await this.call('zkchat', 'addChatMessage', {
            messageId,
            type,
            timestamp: new Date(timestamp),
            sender,
            receiver,
            ciphertext,
            rln,
        });
        res.send(makeResponse(data));
    }

    handleGetDirectMessage = async (req: Request, res: Response) => {
        const {sender, receiver} = req.params;
        const limit = req.query.limit && Number(req.query.limit);
        const offset = req.query.offset && Number(req.query.offset);
        const data = await this.call(
            'zkchat',
            'getDirectMessages',
            sender,
            receiver,
            offset,
            limit,
        );
        res.send(makeResponse(data));
    }

    handleGetDirectChats = async (req: Request, res: Response) => {
        const {pubkey} = req.params;
        const data = await this.call('zkchat', 'getDirectChatsForUser', pubkey);
        res.send(makeResponse(data));
    }

    handleSearchChats = async (req: Request, res: Response) => {
        const {query} = req.params;
        const {sender} = req.query;
        const data = await this.call('zkchat', 'searchChats', query || '', sender);
        res.send(makeResponse(data));
    }

    handleGetProofs = async (req: Request, res: Response) => {
        const {idCommitment} = req.params;
        const {group = ''} = req.query;

        const proof = await this.call('merkle', 'findProof', group, idCommitment);

        res.send(makeResponse({
            data: proof,
            group: group,
        }));
    }

    addRoutes() {
        this.app.get('/healthcheck', this.wrapHandler(async (req, res) => {
            res.send(makeResponse('ok'));
        }));
        this.app.get('/v1/users', this.wrapHandler(this.handleGetUser));
        this.app.get('/v1/users/search/:query?', this.wrapHandler(this.handleSearchUser));
        this.app.get('/v1/users/:address', this.wrapHandler(this.handleGetUserByAddress));
        this.app.post('/v1/users', jsonParser, this.wrapHandler(this.handleAddUser));
        this.app.get('/v1/replies', this.wrapHandler(this.handleGetReplies));
        this.app.get('/v1/posts', this.wrapHandler(this.handleGetPosts));
        this.app.get('/v1/tags/:tagName', this.wrapHandler(this.handleGetPostsByTag));
        this.app.get('/v1/tags', this.wrapHandler(this.handleGetTags));
        this.app.get('/v1/:creator/replies', this.wrapHandler(this.handleGetUserReplies));
        this.app.get('/v1/:creator/likes', this.wrapHandler(this.handleGetUserLikes));
        this.app.get('/v1/homefeed', this.wrapHandler(this.handleGetHomefeed));
        this.app.get('/v1/post/:hash', this.wrapHandler(this.handleGetPostByHash));

        this.app.get('/v1/zkchat/users', this.wrapHandler(this.handleGetChatUsers));
        this.app.post('/v1/zkchat/chat-messages', jsonParser, this.wrapHandler(this.handlePostChatMessage));
        this.app.get('/v1/zkchat/chat-messages/dm/:sender/:receiver', this.wrapHandler(this.handleGetDirectMessage));
        this.app.get('/v1/zkchat/chats/dm/:pubkey', this.wrapHandler(this.handleGetDirectChats));
        this.app.get('/v1/zkchat/chats/search/:query?', this.wrapHandler(this.handleSearchChats));

        this.app.get('/v1/proofs/:idCommitment', this.wrapHandler(this.handleGetProofs));

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

        this.app.get('/dev/interep/:identityCommitment', jsonParser, this.wrapHandler(async (req, res) => {
            const identityCommitment = req.params.identityCommitment;
            // @ts-ignore
            const resp = await fetch(`${config.interrepAPI}/api/v1/groups`);
            const { data: groups } = await resp.json();
            for (const group of groups) {
                // @ts-ignore
                const existResp = await fetch(`${config.interrepAPI}/api/v1/groups/${group.provider}/${group.name}/${identityCommitment}`);
                const { data: exist } = await existResp.json();

                if (exist) {
                    // @ts-ignore
                    const proofResp = await fetch(`${config.interrepAPI}/api/v1/groups/${group.provider}/${group.name}/${identityCommitment}/proof`);
                    const json = await proofResp.json();
                    res.send(makeResponse({
                        ...json,
                        provider: group.provider,
                        name: group.name,
                    }));
                    return;
                }
            }

            res.send(makeResponse(null));
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
                image: preview.images ? preview.images[0] : '',
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

        this.app.post(
            '/ipfs/upload',
            upload.any(),
            this.verifyAuth(
                async () => 'FILE_UPLOAD',
                // @ts-ignore
                async req => req.files[0].originalname.slice(0, 16),
                req => {
                    // @ts-ignore
                    const filepath = path.join(process.cwd(), req.files[0].path);
                    fs.unlinkSync(filepath);
                }
            ),
            this.wrapHandler(async (req, res) => {
                if (!req.files) throw new Error('file missing from formdata');

                // @ts-ignore
                const username = req.username;

                // @ts-ignore
                const {path: relPath, filename, size, mimetype} = req.files[0];
                const uploadDB = await this.call('db', 'getUploads');
                const filepath = path.join(process.cwd(), relPath);

                if (size > maxFileSize) {
                    fs.unlinkSync(filepath);
                    throw new Error('file must be less than 5MB');
                }

                if (username) {
                    const existingSize = await uploadDB.getTotalUploadByUser(username);
                    if (existingSize + size > maxPerUserSize) {
                        fs.unlinkSync(filepath);
                        throw new Error('account is out of space');
                    }
                }


                const files = await getFilesFromPath(filepath);

                const cid = await this.call('ipfs', 'store', files);
                fs.unlinkSync(filepath);

                if (username) {
                    const uploadData: UploadModel = {
                        cid,
                        mimetype,
                        size,
                        filename,
                        username: username,
                    };
                    await uploadDB.addUploadData(uploadData);
                }

                res.send(makeResponse({
                    cid,
                    filename,
                    url: `https://${cid}.ipfs.dweb.link/${filename}`,
                }));
            }),
        );
    }

    async start() {
        const httpServer = http.createServer(this.app);

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
        this.app.use('/circuits/semaphore/wasm', express.static(path.join(process.cwd(), 'static', 'semaphore.wasm')));
        this.app.use('/circuits/semaphore/zkey', express.static(path.join(process.cwd(), 'static', 'semaphore_final.zkey')));
        this.app.use('/circuits/semaphore/vkey', express.static(path.join(process.cwd(), 'static', 'verification_key.json')));

        this.app.use('/circuits/rln/wasm', express.static(path.join(process.cwd(), 'static', 'rln', 'rln.wasm')));
        this.app.use('/circuits/rln/zkey', express.static(path.join(process.cwd(), 'static', 'rln', 'rln_final.zkey')));
        this.app.use('/circuits/rln/vkey', express.static(path.join(process.cwd(), 'static', 'rln', 'verification_key.json')));
        this.addRoutes();

        this.httpServer = httpServer.listen(config.port);
        logger.info(`api server listening at ${config.port}...`);
    }
}