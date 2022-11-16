import 'isomorphic-fetch';
import tape from 'tape';
import sinon from 'sinon';

import HttpService from './http';

import { stubCall, stubFetch } from '@util/testUtils';

const post = {
  type: 'POST',
  subtype: '',
  messageId:
    '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/67e929dd44b631b80e22bd0f94b1b75812e0159117d24bbfba592c9340804fa6',
  hash: '67e929dd44b631b80e22bd0f94b1b75812e0159117d24bbfba592c9340804fa6',
  createdAt: '1648260542270',
  payload: { topic: '', title: '', content: 'auti.sm is a pwa ', reference: '', attachment: '' },
  meta: {
    replyCount: 2,
    likeCount: 2,
    repostCount: 0,
    liked: null,
    reposted: null,
    blocked: null,
    interepProvider: null,
    interepGroup: null,
    rootId:
      '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/67e929dd44b631b80e22bd0f94b1b75812e0159117d24bbfba592c9340804fa6',
    moderation: 'THREAD_HIDE_BLOCK',
    modblockedctx: null,
    modfollowedctx: null,
    modmentionedctx: null,
    modLikedPost: null,
    modBlockedPost: null,
    modBlockedUser: null,
    modFollowerUser: null,
  },
};

const newRequest = (params?: any, body?: any, query?: any): any => {
  return {
    query: {
      limit: 10,
      offset: 0,
      ...query,
    },
    params,
    body,
    header: () => null,
    session: {},
  };
};

const newResponse = (): any => {
  const ret: any = {
    send: sinon.stub(),
  };

  ret.status = sinon.stub().returns(ret);

  return ret;
};

tape('HTTPService - handleGetUser', async t => {
  const http = new HttpService();
  const [call, stubs] = stubCall(http);
  const req = newRequest();
  const res = newResponse();

  stubs.users.readAll.returns(Promise.resolve([{ username: '0xuser1' }, { username: '0xuser2' }]));
  call.withArgs('ens', 'fetchNameByAddress').returns(Promise.resolve(''));

  await http.handleGetUser(req, res);

  t.deepEqual(
    stubs.users.readAll.args[0],
    [undefined, 0, 10],
    'should read users db with correct params'
  );

  t.deepEqual(
    res.send.args[0],
    [
      {
        payload: [
          { ens: '', username: '0xuser1' },
          { ens: '', username: '0xuser2' },
        ],
        error: undefined,
      },
    ],
    'should return list of users'
  );

  t.end();
});

tape('HTTPService - handleSearchUser', async t => {
  const http = new HttpService();
  const [call, stubs] = stubCall(http);
  const req = newRequest({ query: '2728' });
  const res = newResponse();

  stubs.users.search.returns(
    Promise.resolve([{ username: '0xsearchuser1' }, { username: '0xsearchuser2' }])
  );
  call.withArgs('ens', 'fetchNameByAddress').returns(Promise.resolve(''));

  await http.handleSearchUser(req, res);

  t.deepEqual(
    stubs.users.search.args[0],
    ['2728', undefined, 0, 10],
    'should search users db with correct params'
  );

  t.deepEqual(
    res.send.args[0],
    [
      {
        payload: [
          { ens: '', username: '0xsearchuser1' },
          { ens: '', username: '0xsearchuser2' },
        ],
        error: undefined,
      },
    ],
    'should return list of users'
  );

  t.end();
});

tape('HTTPService - handleGetUserByAddress', async t => {
  const http = new HttpService();
  const [call, stubs] = stubCall(http);
  const req = newRequest({ address: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c' });
  const res = newResponse();

  stubs.users.findOneByName.returns(
    Promise.resolve({
      username: '0xmyaddress',
    })
  );

  call.withArgs('ens', 'fetchNameByAddress').returns(Promise.resolve(''));

  await http.handleGetUserByAddress(req, res);

  t.deepEqual(
    stubs.users.findOneByName.args[0],
    ['0xd44a82dD160217d46D754a03C8f841edF06EBE3c', undefined],
    'should get user with correct params'
  );

  t.deepEqual(
    res.send.args[0],
    [
      {
        payload: {
          username: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
          ens: '',
          address: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
        },
        error: undefined,
      },
    ],
    'should return user'
  );

  t.end();
});

tape('HTTPService - handleAddUser', async t => {
  const http = new HttpService();
  const [call, stubs] = stubCall(http);
  const req = newRequest(null, {
    account: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
    publicKey: '0xpubkey',
    proof: '0xproof',
  });
  const res = newResponse();

  stubs.users.findOneByName.returns(
    Promise.resolve({
      username: '0xmyaddress',
    })
  );

  call.withArgs('arbitrum', 'getNonce').returns(Promise.resolve(0));
  call
    .withArgs('ens', 'ecrecover')
    .returns(Promise.resolve('0xd44a82dD160217d46D754a03C8f841edF06EBE3c'));
  call.withArgs('arbitrum', 'updateFor').returns(Promise.resolve('0xtxhash'));

  await http.handleAddUser(req, res);

  t.deepEqual(
    call.args[1],
    [
      'ens',
      'ecrecover',
      '0x87777c0e30f6a3458fd35fa202eec524c2b3b6713bbb3c388d43e9db9040867f',
      '0xproof',
    ],
    'should call ecrecover with hash'
  );

  t.deepEqual(
    call.args[2],
    ['arbitrum', 'updateFor', '0xd44a82dD160217d46D754a03C8f841edF06EBE3c', '0xpubkey', '0xproof'],
    'should call arbitrum contract with correct params'
  );

  t.deepEqual(
    res.send.args[0],
    [
      {
        payload: '0xtxhash',
        error: undefined,
      },
    ],
    'should return tx hash'
  );

  await http.handleAddUser(newRequest(null, {}), res);

  await http.handleAddUser(
    newRequest(null, {
      account: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
    }),
    res
  );

  await http.handleAddUser(
    newRequest(null, {
      account: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
      publicKey: '0xpubkey',
    }),
    res
  );

  t.equal(res.status.args[0][0], 400, 'should return error code');
  t.equal(res.send.args[1][0].payload, 'invalid account', 'should return error message');

  t.equal(res.status.args[1][0], 400, 'should return error code');
  t.equal(res.send.args[2][0].payload, 'invalid publicKey', 'should return error message');

  t.equal(res.status.args[2][0], 400, 'should return error code');
  t.equal(res.send.args[3][0].payload, 'invalid proof', 'should return error message');

  t.end();
});

tape('HTTPService - handleGetReplies', async t => {
  const http = new HttpService();
  const [call, stubs] = stubCall(http);
  const req = newRequest(null, null, {
    parent: '0xparenthash/67e929dd44b631b80e22bd0f94b1b75812e0159117d24bbfba592c9340804fa6',
  });
  const res = newResponse();

  stubs.posts.findOne.returns(
    Promise.resolve({
      subtype: '',
      payload: {},
    })
  );

  stubs.posts.findAllReplies.returns(Promise.resolve([{ hash: '0xposthash' }]));

  await http.handleGetReplies(req, res);

  t.deepEqual(
    stubs.posts.findAllReplies.args[0],
    [
      '0xparenthash/67e929dd44b631b80e22bd0f94b1b75812e0159117d24bbfba592c9340804fa6',
      undefined,
      0,
      10,
      'ASC',
      undefined,
      false,
    ],
    'should find all replies'
  );

  t.deepEqual(
    res.send.args[0],
    [
      {
        payload: [
          {
            hash: '0xposthash',
          },
        ],
        error: undefined,
      },
    ],
    'should return replies'
  );

  stubs.posts.findOne.returns(
    Promise.resolve({
      subtype: 'M_POST',
      payload: {
        topic: 'https://twitter.com/0xTsukino/status/1465780936314740736',
      },
    })
  );

  stubs.posts.findAllReplies.returns(Promise.resolve([{ hash: '0xposthash' }]));
  stubs.posts.findLastTweetInConversation.returns(Promise.resolve({ hash: '0xtweethash' }));

  const fetch = stubFetch();
  fetch.reset();
  fetch.returns(
    Promise.resolve({
      json: async () => ({
        data: [
          {
            author_id: 'yagami',
            created_at: '1234',
            coversation_id: 'threadid',
            in_reply_to_user_id: 'replyid',
            text: 'hello!',
            id: '',
            referenced_tweets: [],
          },
        ],
      }),
    })
  );
  await http.handleGetReplies(req, res);

  t.deepEqual(
    fetch.args[0],
    [
      'https://api.twitter.com/2/tweets/search/recent?query=conversation_id:1465780936314740736&since_id=0xtweethash&max_results=100&expansions=author_id,in_reply_to_user_id&tweet.fields=referenced_tweets,in_reply_to_user_id,author_id,created_at,conversation_id&user.fields=name,username',
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer twBearerToken',
        },
      },
    ],
    'should fetch twitter replies'
  );

  t.deepEqual(
    stubs.posts.createTwitterPosts.args[0],
    [
      [
        {
          messageId: '',
          hash: '',
          creator: 'yagami',
          type: '@TWEET@',
          subtype: '',
          createdAt: -23225875200000,
          topic: '',
          title: '',
          content: 'hello!',
          reference: '1465780936314740736',
          attachment: '',
        },
      ],
    ],
    'should create twitter replies'
  );

  fetch.reset();
  t.end();
});

tape('HTTPService - handleGetPosts', async t => {
  const http = new HttpService();
  const [call, stubs] = stubCall(http);
  const req = newRequest();
  const res = newResponse();

  stubs.posts.findAllPosts.returns(Promise.resolve([post]));

  await http.handleGetPosts(req, res);

  t.deepEqual(
    stubs.posts.findAllPosts.args[0],
    [undefined, undefined, 0, 10, undefined, false],
    'should find all posts'
  );

  t.deepEqual(res.send.args[0], [{ payload: [post], error: undefined }], 'should return all posts');

  t.end();
});

tape('HTTPService - handleGetPostsByTag', async t => {
  const http = new HttpService();
  const [call, stubs] = stubCall(http);
  const req = newRequest({ tagName: '#unittest' });
  const res = newResponse();

  stubs.tags.getPostsByTag.returns(Promise.resolve([post]));

  await http.handleGetPostsByTag(req, res);

  t.deepEqual(
    stubs.tags.getPostsByTag.args[0],
    ['#unittest', undefined, 0, 10],
    'should find all posts'
  );

  t.deepEqual(res.send.args[0], [{ payload: [post], error: undefined }], 'should return all posts');

  t.end();
});

tape('HTTPService - handleGetTags', async t => {
  const http = new HttpService();
  const [call, stubs] = stubCall(http);
  const req = newRequest();
  const res = newResponse();

  stubs.meta.findTags.returns(Promise.resolve([{ tagName: '#test' }]));

  await http.handleGetTags(req, res);

  t.deepEqual(stubs.meta.findTags.args[0], [0, 10], 'should find all tags');

  t.deepEqual(
    res.send.args[0],
    [{ payload: [{ tagName: '#test' }], error: undefined }],
    'should return all tags'
  );

  t.end();
});

tape('HTTPService - handleGetUserReplies', async t => {
  const http = new HttpService();
  const [call, stubs] = stubCall(http);
  const req = newRequest({
    creator: '0xmyuser',
  });
  const res = newResponse();

  stubs.posts.findAllRepliesFromCreator.returns(Promise.resolve([post]));

  await http.handleGetUserReplies(req, res);

  t.deepEqual(
    stubs.posts.findAllRepliesFromCreator.args[0],
    ['0xmyuser', undefined, 0, 10],
    'should find all replies'
  );

  t.deepEqual(
    res.send.args[0],
    [{ payload: [post], error: undefined }],
    'should return all replies'
  );

  t.end();
});

tape('HTTPService - handleGetUserLikes', async t => {
  const http = new HttpService();
  const [call, stubs] = stubCall(http);
  const req = newRequest({
    creator: '0xmyuser',
  });
  const res = newResponse();

  stubs.posts.findAllLikedPostsByCreator.returns(Promise.resolve([post]));

  await http.handleGetUserLikes(req, res);

  t.deepEqual(
    stubs.posts.findAllLikedPostsByCreator.args[0],
    ['0xmyuser', undefined, 0, 10],
    'should find all likes'
  );

  t.deepEqual(res.send.args[0], [{ payload: [post], error: undefined }], 'should return all likes');

  t.end();
});

tape('HTTPService - handleGetHomefeed', async t => {
  const http = new HttpService();
  const [call, stubs] = stubCall(http);
  const req = newRequest({
    creator: '0xmyuser',
  });
  const res = newResponse();

  stubs.posts.getHomeFeed.returns(Promise.resolve([post]));

  await http.handleGetHomefeed(req, res);

  t.deepEqual(stubs.posts.getHomeFeed.args[0], [undefined, 0, 10], 'should find home feed');

  t.deepEqual(res.send.args[0], [{ payload: [post], error: undefined }], 'should return home feed');

  t.end();
});

tape('HTTPService - handleGetPostByHash', async t => {
  const http = new HttpService();
  const [call, stubs] = stubCall(http);
  const req = newRequest({
    hash: '0xposthash',
  });
  const res = newResponse();

  stubs.posts.findOne.returns(Promise.resolve(post));

  await http.handleGetPostByHash(req, res);

  t.deepEqual(stubs.posts.findOne.args[0], ['0xposthash', undefined], 'should find post by hash');

  t.deepEqual(
    res.send.args[0],
    [{ payload: post, error: undefined }],
    'should return post by hash'
  );

  t.end();
});

tape('HTTPService - Interep Signup', async t => {
  const http = new HttpService();
  const [call, stubs] = stubCall(http);
  const res = newResponse();

  const getStub = sinon.stub(http.app, 'get');
  const postStub = sinon.stub(http.app, 'post');

  http.addRoutes();

  const interepSignupParams = postStub.args[3];
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

tape('HTTPService - get interep ID commitment', async t => {
  const http = new HttpService();
  const [, stubs] = stubCall(http);
  const res = newResponse();

  const getStub = sinon.stub(http.app, 'get');

  http.addRoutes();

  const interepGetIdParams = getStub.args[28];
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

tape('HttpService - list all users who liked a post', async t => {
  const http = new HttpService();
  const [, stubs] = stubCall(http);
  const res = newResponse();
  const likers = ['0xfoo/hash1', '0xbar/hash2'];

  stubs.moderations.findAllLikesByReference.returns(Promise.resolve(likers));

  await http.handleGetLikesByPost(newRequest({ hash: 'test' }, null, null), res);

  t.deepEqual(res.send.args[0][0].payload, likers, 'should be equal');
  t.end();
});

tape('HttpService - get followers per user', async t => {
  const http = new HttpService();
  const [, stubs] = stubCall(http);
  const res = newResponse();
  const followers = ['0xfoo', '0xbar'];

  stubs.connections.findAllFollowersByName.returns(Promise.resolve(followers));

  await http.handleGetUserFollowers(newRequest({ user: '0xr1oga' }, null, null), res);

  t.deepEqual(res.send.args[0][0].payload, followers, 'should be equal');
  t.end();
});

tape('HttpService - get followings per user', async t => {
  const http = new HttpService();
  const [, stubs] = stubCall(http);
  const res = newResponse();
  const followings = ['0xfoo', '0xbar'];

  stubs.connections.findAllFollowingsByCreator.returns(Promise.resolve(followings));

  await http.handleGetUserFollowings(newRequest({ user: '0xr1oga' }, null, null), res);

  t.deepEqual(res.send.args[0][0].payload, followings, 'should be equal');
  t.end();
});

tape.skip('EXIT', t => {
  t.end();
  process.exit(0);
});
