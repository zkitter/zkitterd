import { Request, Response } from 'express';
import { makeResponse } from '../utils';
import { Controller } from './interface';

export class PostsController extends Controller {
  constructor() {
    super();
    this.init();
  }

  public addRoutes() {
    this.router.get('/v1/homefeed', this.homefeed);
    this.router.get('/v1/posts', this.all);
    this.router.get('/v1/post/:hash', this.one);
    this.router.get('/v1/post/:hash/likes', this.likes);
  }

  all = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const creator = req.query.creator;
    const context = req.header('x-contextual-name') || undefined;
    const postDB = await this.call('db', 'getPosts');
    const posts = await postDB.findAllPosts(creator, context, offset, limit, undefined, !!creator);
    res.send(makeResponse(posts));
  };

  one = async (req: Request, res: Response) => {
    const hash = req.params.hash;
    const context = req.header('x-contextual-name') || undefined;
    const postDB = await this.call('db', 'getPosts');
    const post = await postDB.findOne(hash, context);
    res.send(makeResponse(post));
  };

  likes = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const hash = req.params.hash;
    const moderationsDB = await this.call('db', 'getModerations');
    const likers = await moderationsDB.findAllLikesByReference(hash, offset, limit);
    res.send(makeResponse(likers));
  };

  homefeed = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const context = req.header('x-contextual-name') || undefined;
    const postDB = await this.call('db', 'getPosts');
    const posts = await postDB.getHomeFeed(context, offset, limit);
    res.send(makeResponse(posts));
  };
}
