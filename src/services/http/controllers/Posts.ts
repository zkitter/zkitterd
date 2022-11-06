import { Request, Response } from 'express';

import { Controller } from './interface';
import { makeResponse } from '../utils';
import { parseMessageId, PostMessageSubType } from '../../../util/message';
import { getReplies } from '../../../util/twitter';

export class PostsController extends Controller {
  prefix = '/v1';

  constructor() {
    super();
    this.addRoutes();
  }

  public addRoutes() {
    this._router.get('/homefeed', this.homefeed);
    this._router.get('/posts', this.getMany);
    this._router.get('/post/:hash', this.getOne);
    this._router.get('/post/:hash/likes', this.getLikes);
    this._router.get('/post/:hash/retweets', this.getRetweets);
    this._router.get('/replies', this.getReplies);
  }

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
      const [__, _, id] = tweetUrl.replace('https://twitter.com/', '').split('/');
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
