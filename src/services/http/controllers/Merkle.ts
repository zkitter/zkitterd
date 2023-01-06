import { Request, Response } from 'express';

import { makeResponse } from '../utils';
import { Controller } from './interface';

export class MerkleController extends Controller {
  prefix = '/v1';

  constructor() {
    super();
    this.addRoutes();
  }

  addRoutes = () => {
    this._router.get('/proofs/:idCommitment', this.findProof);
    this._router.get('/group_members/:group', this.getMembers);
  };

  findProof = async (req: Request, res: Response) => {
    const { idCommitment } = req.params;
    const { group = '', proofType = '' } = req.query;
    const proof = await this.call('merkle', 'findProof', idCommitment, group, proofType);

    res.send(makeResponse({ data: proof }));
  };

  getMembers = async (req: Request, res: Response) => {
    const { group } = req.params;
    const leaves = await this.call('merkle', 'getAllLeaves', group);
    res.send(makeResponse(leaves));
  };
}
