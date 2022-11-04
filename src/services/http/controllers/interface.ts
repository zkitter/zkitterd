import { Router } from 'express';
import { GenericService } from '../../../util/svc';
import { logAfter, logBefore } from '../middlewares/log';

export abstract class Controller extends GenericService {
  public router = Router();

  addPreMiddlewares() {
    this.router.use(logBefore);
  }

  abstract addRoutes(): void;

  addPostMiddlewares() {
    this.router.use(logAfter);
  }

  init() {
    this.addPreMiddlewares();
    this.addRoutes();
    this.addPostMiddlewares();
  }
}
