import { Request, Response } from 'express';

import { Controller } from './interface';
import { makeResponse } from '../utils';

export class TagsController extends Controller {
  constructor() {
    super();
    this.init();
  }

  addRoutes = () => {
    this.router.get('/tags', this.all);
    this.router.get('/tags.:tagName', this.postsByTagName);
  };

  all = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const db = await this.call('db', 'getMeta');
    const tags = await db.findTags(offset, limit);
    res.send(makeResponse(tags));
  };

  postsByTagName = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const tagName = req.params.tagName;
    const context = req.header('x-contextual-name') || undefined;
    const tagDB = await this.call('db', 'getTags');
    const posts = await tagDB.getPostsByTag(tagName, context, offset, limit);
    res.send(makeResponse(posts));
  };
}
