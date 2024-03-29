import { Request, Response, Router } from 'express';
import config from '@util/config';
import { createHeader } from '@util/twitter';
import { makeResponse } from '../utils';
import { Controller } from './interface';

export class InterepController extends Controller {
  constructor() {
    super();
    this.addRoutes();
  }

  addRoutes = () => {
    this._router.use(
      '/interrep',
      Router()
        .get('/:identityCommitment', this.proof)
        .post('/groups/:provider/:name/:identityCommitment', this.signUp)
    );

    this._router.get('/dev/interep/:identityCommitment', this.devProof);
  };

  proof = async (req: Request, res: Response) => {
    const identityCommitment = req.params.identityCommitment;
    const semaphoreDB = await this.call('db', 'getSemaphore');
    // const exist = await semaphoreDB.findOneByCommitment(identityCommitment);

    // if (!exist || exist?.updatedAt.getTime() + 15 * 60 * 1000 > Date.now()) {
    //     await this.call('interrep', 'scanIDCommitment', identityCommitment);
    // }

    const sem = await semaphoreDB.findAllByCommitment(identityCommitment);
    const [group] = sem;

    if (!group) {
      res.status(404).send(makeResponse('not found', true));
      return;
    }

    const resp = await fetch(
      `${config.interrepAPI}/api/v1/groups/${group.provider}/${group.name}/${identityCommitment}/proof`
    );
    const json = await resp.json();
    res.send(
      makeResponse({
        ...json,
        name: group.name,
        provider: group.provider,
      })
    );
  };

  signUp = async (req: Request, res: Response) => {
    const { identityCommitment, name, provider } = req.params;
    if (!['twitter', 'github', 'reddit'].includes(provider))
      throw new Error(`joining ${provider} interep groups not supported`);

    let headers;

    // TODO refactor twitter with passport
    if (provider === 'twitter') {
      // @ts-expect-error
      if (!req.user?.username) throw new Error('not authenticated');

      const authDb = await this.call('db', 'getAuth');
      // @ts-expect-error
      const { refreshToken, token } = await authDb.findToken(req.user.username, req.user.provider);

      headers = createHeader(
        {
          method: 'GET',
          url: `https://api.twitter.com/1.1/account/verify_credentials.json`,
        },
        token,
        refreshToken
      );
    }

    if (provider === 'github' || provider === 'reddit') {
      // @ts-expect-error
      if (!req.user?.username) throw new Error('not authenticated');

      const authDb = await this.call('db', 'getAuth');
      // @ts-expect-error
      const { token } = await authDb.findToken(req.user.username, req.user.provider);

      headers = { Authorization: `Bearer ${token}` };
    }

    const resp = await fetch(
      `${config.interrepAPI}/api/v1/groups/${provider}/${name}/${identityCommitment}`,
      {
        headers,
        method: 'POST',
      }
    );

    if (resp.status !== 201) {
      res.status(resp.status).send(makeResponse(resp.statusText, true));
      return;
    }

    const json = await resp.json();

    res.send(makeResponse(json));
  };

  devProof = async (req: Request, res: Response) => {
    const identityCommitment = req.params.identityCommitment;

    const resp = await fetch(`${config.interrepAPI}/api/v1/groups`);
    const { data: groups } = await resp.json();
    for (const group of groups) {
      const existResp = await fetch(
        `${config.interrepAPI}/api/v1/groups/${group.provider}/${group.name}/${identityCommitment}`
      );
      const { data: exist } = await existResp.json();

      if (exist) {
        const proofResp = await fetch(
          `${config.interrepAPI}/api/v1/groups/${group.provider}/${group.name}/${identityCommitment}/proof`
        );
        const json = await proofResp.json();
        res.send(
          makeResponse({
            ...json,
            name: group.name,
            provider: group.provider,
          })
        );
        return;
      }
    }

    res.send(makeResponse(null));
  };
}
