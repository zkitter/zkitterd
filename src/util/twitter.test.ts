import tape from 'tape';
import { accessToken, requestToken, verifyCredential } from './twitter';
import { stubFetch } from './testUtils';

const fetchStub = stubFetch();

tape('twitter - requestToken', async t => {
  fetchStub.resolves({ status: 200, text: async () => 'token' });

  const ret = await requestToken();

  t.equal(
    fetchStub.args[0][0],
    'https://api.twitter.com/oauth/request_token',
    'should request token from twitter'
  );
  t.equal(ret, 'token', 'should return text');

  fetchStub.reset();
});

tape('twitter - accessToken', async t => {
  fetchStub.resolves({ status: 200, text: async () => 'token' });

  const ret = await accessToken('1', '2', '3');

  t.equal(
    fetchStub.args[0][0],
    'https://api.twitter.com/oauth/access_token',
    'should access token from twitter'
  );
  t.equal(ret, 'token', 'should return text');

  fetchStub.reset();
});

tape('twitter - verifyCredential', async t => {
  fetchStub.resolves({
    status: 200,
    json: async () => 'token',
  });

  const ret = await verifyCredential('1', '2');

  t.equal(
    fetchStub.args[0][0],
    'https://api.twitter.com/1.1/account/verify_credentials.json',
    'should access token from twitter'
  );
  t.equal(ret, 'token', 'should return text');

  fetchStub.reset();
});
