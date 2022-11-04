import tape from 'tape';

import { PostsController } from './Posts';
import { newRequest, newResponse, stubCall } from '../../../util/testUtils';

let controller: PostsController;
let call: ReturnType<typeof stubCall>[0];
let stubs: ReturnType<typeof stubCall>[1];
let req: ReturnType<typeof newRequest>;
let res: ReturnType<typeof newResponse>;

const init = (...params: Parameters<typeof newRequest>) => {
  controller = new PostsController();
  const stubCallRes = stubCall(controller);
  call = stubCallRes[0];
  stubs = stubCallRes[1];
  req = newRequest(...params);
  res = newResponse();
};

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

tape('PostsController', t => {
  t.test('GET /v1/posts', async t => {
    init();
    stubs.posts.findAllPosts.returns(Promise.resolve([post]));

    await controller.all(req, res);

    t.deepEqual(
      stubs.posts.findAllPosts.args[0],
      [undefined, undefined, 0, 10, undefined, false],
      'should find all posts'
    );

    t.deepEqual(
      res.send.args[0],
      [{ payload: [post], error: undefined }],
      'should return all posts'
    );

    t.end();
  });

  t.test('GET /v1/homefeed', async t => {
    init({
      creator: '0xmyuser',
    });
    stubs.posts.getHomeFeed.returns(Promise.resolve([post]));

    await controller.homefeed(req, res);

    t.deepEqual(stubs.posts.getHomeFeed.args[0], [undefined, 0, 10], 'should find home feed');
    t.deepEqual(
      res.send.args[0],
      [{ payload: [post], error: undefined }],
      'should return home feed'
    );

    t.end();
  });

  t.test('GET /v1/post/:hash:likes', async t => {
    init({ hash: 'test' });
    const likers = ['0xfoo/hash1', '0xbar/hash2'];
    stubs.moderations.findAllLikesByReference.returns(Promise.resolve(likers));

    await controller.likes(newRequest({ hash: 'test' }, null, null), res);

    t.deepEqual(res.send.args[0][0].payload, likers, 'should be equal');
    t.end();
  });
});
