import sinon from 'sinon';

import tape from 'tape';
import { newRequest, newResponse } from '../../../util/testUtils';
import { MerkleController } from './Merkle';

let controller: MerkleController;
let req: ReturnType<typeof newRequest>;
let res: ReturnType<typeof newResponse>;

const init = (...params: Parameters<typeof newRequest>) => {
  controller = new MerkleController();
  req = newRequest(...params);
  res = newResponse();
};

tape('MerkleController', t => {
  t.test('GET /v1/proofs/:idCommitment', async t => {
    const idCommitment = 'foo';
    const proofType = '123';
    const group = 'bar';
    init({ idCommitment }, {}, { group, proofType });
    const stub = sinon.stub(controller, 'call').withArgs('merkle', 'findProof').resolves('proof');

    await controller.findProof(req, res);

    t.deepEqual(stub.args[0].slice(2), [idCommitment, group, proofType], 'should find proof');
    t.deepEqual(
      res.send.args[0][0],
      { error: undefined, payload: { data: 'proof' } },
      'should return proof'
    );
  });

  t.test('GET /v1/group_members/:group', async t => {
    const group = 'somegroup';
    const leaves = ['leaf1', 'leaf2'];
    init({ group: 'somegroup' });
    const stub = sinon.stub(controller, 'call').withArgs('merkle', 'getAllLeaves').resolves(leaves);

    await controller.getMembers(req, res);

    t.deepEqual(stub.args[0].slice(2), [group], 'should find all members (leaves)');
    t.deepEqual(
      res.send.args[0][0],
      { error: undefined, payload: leaves },
      'should return all members (leaves)'
    );
  });
});
