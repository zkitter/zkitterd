import { json, Router } from 'express';
import { GenericService } from '../../../util/svc';
import { logAfter, logBefore } from '../middlewares/log';

export abstract class Controller extends GenericService {
  protected _router = Router();
  prefix: string | undefined;

  get router() {
    return this.prefix ? Router().use(this.prefix, this._router) : this._router;
  }

  addPreMiddlewares() {
    this._router.use(logBefore, json());
  }

  abstract addRoutes(): void;

  addPostMiddlewares() {
    this._router.use(logAfter);
  }

  init() {
    this.addPreMiddlewares();
    this.addRoutes();
    this.addPostMiddlewares();
  }
}
