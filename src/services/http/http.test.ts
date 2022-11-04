import 'isomorphic-fetch';
import tape from 'tape';
import sinon from 'sinon';
import HttpService from '.';
import { newRequest, newResponse, stubCall, stubFetch } from '../../util/testUtils';
import { post } from './_fixtures';

tape.skip('HTTPService - Interep Signup', async t => {
  const http = new HttpService();
  const [call, stubs] = stubCall(http);
  const res = newResponse();

  const getStub = sinon.stub(http.app, 'get');
  const postStub = sinon.stub(http.app, 'post');

  // http.addRoutes();

  const interepSignupParams = postStub.args[4];
  // @ts-ignore
  const signupHandler: any = interepSignupParams[2];
  const signupRequest = newRequest({
    identityCommitment: '0xidcommitment',
    provider: 'myspace',
    name: 'diamond',
  });
  signupRequest.session.twitterToken =
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

  await signupHandler(signupRequest, res);

  t.equal(
    interepSignupParams[0],
    '/interrep/groups/:provider/:name/:identityCommitment',
    'should listen to correct path'
  );

  t.deepEqual(
    fetchStub.args[0][0],
    'https://kovan.interep.link/api/v1/groups/myspace/diamond/0xidcommitment',
    'should make request to interep'
  );

  t.deepEqual(
    res.send.args[0],
    [{ payload: 'BOOM!', error: undefined }],
    'should return result from interep'
  );

  fetchStub.reset();
  t.end();
});

tape.skip('HTTPService - get interep ID commitment', async t => {
  const http = new HttpService();
  const [, stubs] = stubCall(http);
  const res = newResponse();

  const getStub = sinon.stub(http.app, 'get');

  // http.addRoutes();

  const interepGetIdParams = getStub.args[27];
  // @ts-ignore
  const getIdHandler: any = interepGetIdParams[2];
  const getIdRequest = newRequest({
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
        provider: 'myspace',
        name: 'diamond',
      },
    ])
  );

  await getIdHandler(getIdRequest, res);

  t.equal(interepGetIdParams[0], '/interrep/:identityCommitment', 'should listen to correct path');

  t.deepEqual(
    fetchStub.args[0][0],
    'https://kovan.interep.link/api/v1/groups/myspace/diamond/0xidcommitment/proof',
    'should make request to interep'
  );

  t.deepEqual(
    res.send.args[0],
    [
      {
        payload: {
          siblings: [0, 1, 0],
          provider: 'myspace',
          name: 'diamond',
        },
        error: undefined,
      },
    ],
    'should return correct result from interep'
  );

  fetchStub.reset();
  t.end();
});

// FIXME
tape.skip('HTTPService - get preview', async t => {
  const http = new HttpService();
  const [call, stubs] = stubCall(http);
  const res = newResponse();

  const getStub = sinon.stub(http.app, 'get');
  sinon.stub(http.app, 'post');

  http.addRoutes();

  const getPreviewParams = getStub.args[23];
  // @ts-ignore
  const getPreviewHandler: any = getPreviewParams[1];
  const getPreviewRequest = newRequest(null, null, { link: 'https://auti.sm' });
  await getPreviewHandler(getPreviewRequest, res);

  t.equal(getPreviewParams[0], '/preview', 'should listen to correct path');

  t.deepEqual(
    res.send.args[0][0],
    {
      payload: {
        link: 'https://www.auti.sm/',
        mediaType: 'website',
        contentType: 'text/html',
        title: 'Auti.sm',
        description: '',
        image: undefined,
        favicon: '',
      },
      error: undefined,
    },
    'should return correct result from interep'
  );

  t.end();
});

// tape('EXIT', t => {
//   t.end();
//   process.exit(0);
// });
