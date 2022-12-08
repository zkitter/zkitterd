import { Router } from 'express';
import { GenericService } from '../../../util/svc';

export abstract class Controller extends GenericService {
  protected _router = Router();
  prefix: string | undefined;

  get router() {
    return this.prefix ? Router().use(this.prefix, this._router) : this._router;
  }

  abstract addRoutes(): void;
}
