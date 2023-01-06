import { Request, Response } from 'express';

import { makeResponse } from '../utils';
import { Controller } from './interface';

export class TagsController extends Controller {
  prefix = '/v1';

  constructor() {
    super();
    this.addRoutes();
  }

  addRoutes = () => {
    this._router.get('/tags', this.getMany);
    this._router.get('/tags/:tagName', this.getPostsByTagName);
  };

  getMany = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const db = await this.call('db', 'getMeta');
    const tags = await db.findTags(offset, limit);
    res.send(makeResponse(tags));
  };

  getPostsByTagName = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const tagName = req.params.tagName;
    const context = req.header('x-contextual-name') || undefined;
    const tagDB = await this.call('db', 'getTags');
    const posts = await tagDB.getPostsByTag(tagName, context, offset, limit);
    res.send(makeResponse(posts));
  };
}
