import tape from 'tape';

import { InterepController } from './Interep';
import { newRequest, newResponse, stubCall, stubFetch } from '../../../util/testUtils';

let controller: InterepController;
/* eslint-disable @typescript-eslint/no-unused-vars */
let call: ReturnType<typeof stubCall>[0];
let stubs: ReturnType<typeof stubCall>[1];
let req: ReturnType<typeof newRequest>;
let res: ReturnType<typeof newResponse>;

const init = (...params: Parameters<typeof newRequest>) => {
  controller = new InterepController();
  const stubCallRes = stubCall(controller);
  call = stubCallRes[0];
  stubs = stubCallRes[1];
  req = newRequest(...params);
  res = newResponse();
};

tape('InterepController', t => {
  t.test('POST /v1/interrep/groups/:provider/:name/:identityCommitment', async t => {
    init({
      identityCommitment: '0xidcommitment',
      provider: 'twitter',
      name: 'diamond',
    });
    req.session.twitterToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ._w7sKWvl7ojSC6JdSwY6VAaj4lbZ89o8PIhUaNtQeww';
    stubs.twitterAuths.findUserByToken.returns(
      Promise.resolve({
        user_token: 'userToken',
        user_token_secret: 'userTokenSecret',
      })
    );
    const fetchStub = stubFetch();
    fetchStub.returns(
      Promise.resolve({
        status: 201,
        json: async () => 'BOOM!',
      })
    );

    await controller.signUp(req, res);

    t.deepEqual(
      fetchStub.args[0][0],
      'https://kovan.interep.link/api/v1/groups/twitter/diamond/0xidcommitment',
      'should make request to interep'
    );
    t.deepEqual(
      res.send.args[0],
      [{ payload: 'BOOM!', error: undefined }],
      'should return result from interep'
    );

    fetchStub.reset();
  });

  t.test('GET /v1/interrep/:identityCommitment', async t => {
    init({
      identityCommitment: '0xidcommitment',
    });
    const fetchStub = stubFetch();
    fetchStub.returns(
      Promise.resolve({
        json: async () => ({ siblings: [0, 1, 0] }),
      })
    );
    stubs.semaphore.findAllByCommitment.returns(
      Promise.resolve([
        {
          provider: 'twitter',
          name: 'diamond',
        },
      ])
    );

    await controller.proof(req, res);

    t.deepEqual(
      fetchStub.args[0][0],
      'https://kovan.interep.link/api/v1/groups/twitter/diamond/0xidcommitment/proof',
      'should make request to interep'
    );
    t.deepEqual(
      res.send.args[0],
      [
        {
          payload: {
            siblings: [0, 1, 0],
            provider: 'twitter',
            name: 'diamond',
          },
          error: undefined,
        },
      ],
      'should return correct result from interep'
    );

    fetchStub.reset();
  });
});
