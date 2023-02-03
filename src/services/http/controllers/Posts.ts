import { Request, Response } from 'express';

import { parseMessageId, PostMessageSubType } from '@util/message';
import { getReplies } from '@util/twitter';
import { makeResponse } from '../utils';
import { Controller } from './interface';
import DBService from '@services/db';
import GunService from '@services/gun';

let CACHED_HISTORY: any[] | null = null;

export class PostsController extends Controller {
  prefix = '/v1';

  constructor() {
    super();
    this.addRoutes();
  }

  public addRoutes() {
    this._router
      .get('/homefeed', this.homefeed)
      .get('/posts', this.getMany)
      .post('/posts/search', this.search)
      .get('/post/:hash', this.getOne)
      .get('/post/:hash/likes', this.getLikes)
      .get('/post/:hash/retweets', this.getRetweets)
      .get('/replies', this.getReplies)
      .get('/history', this.getHistory);
  }

  getHistory = async (req: Request, res: Response) => {
    if (CACHED_HISTORY) {
      res.send(makeResponse(CACHED_HISTORY));
      return;
    }

    const db = (await this.main?.services.db) as DBService;
    const gunSvc = this.main?.services.gun as GunService;
    const { gun } = gunSvc;
    const users = await db.users?.readAll();
    const messages: any[] = [];

    await new Promise(resolve => {
      let timeout: any = null;
      gun!
        .get('message')
        .map()
        .once(async (data, messageId) => {
          const msg = await gunSvc!.parseGunMessage(data, messageId);
          messages.push(msg);
          if (timeout) clearTimeout(timeout);
          timeout = setTimeout(resolve, 500);
        });
    });

    for (const user of users!) {
      if (await db.users?.findOneByPubkey(user.pubkey)) {
        await new Promise(resolve => {
          let timeout: any = setTimeout(resolve, 500);
          gun!
            .user(user.pubkey)
            .get('message')
            .map()
            .once(async (data, messageId) => {
              try {
                const msg = await gunSvc!.parseGunMessage(data, messageId, user.pubkey);
                messages.push(msg);
              } catch (err) {}

              if (timeout) clearTimeout(timeout);
              timeout = setTimeout(resolve, 500);
            });
        });
      }
    }

    CACHED_HISTORY = messages;
    res.send(makeResponse(messages));
  };

  homefeed = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const context = req.header('x-contextual-name') || undefined;
    const postDB = await this.call('db', 'getPosts');
    const posts = await postDB.getHomeFeed(context, offset, limit);
    res.send(makeResponse(posts));
  };

  getMany = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const creator = req.query.creator;
    const context = req.header('x-contextual-name') || undefined;
    const postDB = await this.call('db', 'getPosts');
    const posts = await postDB.findAllPosts(creator, context, offset, limit, undefined, !!creator);
    res.send(makeResponse(posts));
  };

  getOne = async (req: Request, res: Response) => {
    const hash = req.params.hash;
    const context = req.header('x-contextual-name') || undefined;
    const postDB = await this.call('db', 'getPosts');
    const post = await postDB.findOne(hash, context);
    res.send(makeResponse(post));
  };

  search = async (req: Request, res: Response) => {
    const limit = req.body.limit && Number(req.body.limit);
    const offset = req.body.offset && Number(req.body.offset);
    const query = req.body.query;
    const postDB = await this.call('db', 'getPosts');
    const posts = await postDB.search(query, offset, limit);
    res.send(makeResponse(posts));
  };

  getLikes = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const hash = req.params.hash;
    const moderationsDB = await this.call('db', 'getModerations');
    const likers = await moderationsDB.findAllLikesByReference(hash, offset, limit);
    res.send(makeResponse(likers));
  };

  getRetweets = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const hash = req.params.hash;
    const postsDB = await this.call('db', 'getPosts');
    const retweets = await postsDB.findAllRetweets(hash, offset, limit);
    res.send(makeResponse(retweets));
  };

  getReplies = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const parent = req.query.parent;
    const { hash } = parseMessageId(parent as string);
    const context = req.header('x-contextual-name') || undefined;
    const unmoderated = (req.header('x-unmoderated') || '') === 'true';
    const postDB = await this.call('db', 'getPosts');
    const parentPost = await postDB.findOne(hash, context);

    let tweetId;

    if (parentPost?.subtype === PostMessageSubType.MirrorPost) {
      const tweetUrl = parentPost.payload.topic;
      const [, , id] = tweetUrl.replace('https://twitter.com/', '').split('/');
      tweetId = id;
      const lastTweet = await postDB.findLastTweetInConversation(id);
      const tweets = await getReplies(tweetUrl, lastTweet?.hash);
      await postDB.createTwitterPosts(tweets);
    }

    const posts = await postDB.findAllReplies(
      parent,
      context,
      offset,
      limit,
      'ASC',
      tweetId,
      unmoderated
    );
    res.send(makeResponse(posts));
  };
}
