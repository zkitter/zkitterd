import { GenericService } from '../../../util/svc';
import { Router } from 'express';

export abstract class Controller extends GenericService {
  router: Router;
}
