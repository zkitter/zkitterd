import { json, Request, Response, Router } from 'express';
import crypto from 'crypto';

import { Controller } from './interface';
import { makeResponse } from '../utils';
import { addConnection, addTopic, keepAlive, removeConnection } from '../../../util/sse';

export class EventsController extends Controller {
  constructor() {
    super();
    this.init();
  }

  addRoutes = () => {
    this.router.use(
      '/events',
      Router()
        .get('', this.all)
        .post('/:clientId', this.updateSSE)
        .get('/:clietnId/alive', this.keepAliveSSE)
        .get('/:clientId', this.terminateSSE)
    );
  };

  all = async (req: Request, res: Response) => {
    const headers = {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
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
