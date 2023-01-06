import crypto from 'crypto';
import { Request, Response, Router } from 'express';

import { addConnection, addTopic, keepAlive, removeConnection } from '@util/sse';
import { makeResponse } from '../utils';
import { Controller } from './interface';

export class EventsController extends Controller {
  prefix = '/v1';

  constructor() {
    super();
    this.addRoutes();
  }

  addRoutes = () => {
    this._router.use(
      '/events',
      Router()
        .get('', this.getMany)
        .post('/:clientId', this.updateSSE)
        .get('/:clientId/alive', this.keepAliveSSE)
        .get('/:clientId', this.terminateSSE)
    );
  };

  getMany = async (req: Request, res: Response) => {
    const headers = {
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream',
    };

    res.writeHead(200, headers);

    const clientId = crypto.randomBytes(16).toString('hex');

    addConnection(clientId, res);
  };

  updateSSE = async (req: Request, res: Response) => {
    const { clientId } = req.params;
    const { topics } = req.body;

    for (const topic of topics) {
      addTopic(clientId, topic);
    }

    res.send(makeResponse('ok'));
  };

  keepAliveSSE = async (req: Request, res: Response) => {
    const { clientId } = req.params;
    keepAlive(clientId);
    res.send(makeResponse('ok'));
  };

  terminateSSE = async (req: Request, res: Response) => {
    const { clientId } = req.params;
    removeConnection(clientId);
    res.send(makeResponse('ok'));
  };
}
