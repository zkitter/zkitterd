import tape from 'tape';

import { PostsController } from './Posts';
import { newRequest, newResponse, stubCall, stubFetch } from '../../../util/testUtils';
import { post } from '../../http/_fixtures';

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

tape('PostsController', t => {
  t.test('GET /v1/posts', async t => {
    init();
    stubs.posts.findAllPosts.returns(Promise.resolve([post]));

    await controller.getMany(req, res);

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

  t.test('GET /v1/post/:hash/likes', async t => {
    init({ hash: 'test' });
    const likers = ['0xfoo/hash1', '0xbar/hash2'];
    stubs.moderations.findAllLikesByReference.returns(Promise.resolve(likers));

    await controller.getLikes(newRequest({ hash: 'test' }, null, null), res);

    t.deepEqual(res.send.args[0][0].payload, likers, 'should return all users who liked a post');

    t.end();
  });

  t.test('GET /v1/post/:hash/retweets', async t => {
    init({ hash: 'test' });
    const retweets = ['0xfoo/hash1', '0xbar/hash2'];
    stubs.moderations.findAllLikesByReference.returns(Promise.resolve(retweets));

    await controller.getLikes(newRequest({ hash: 'test' }, null, null), res);

    t.deepEqual(
      res.send.args[0][0].payload,
      retweets,
      'should return all users who retweeted a post'
    );

    t.end();
  });

  t.test('GET /v1/replies', async t => {
    init(null, null, {
      parent: '0xparenthash/67e929dd44b631b80e22bd0f94b1b75812e0159117d24bbfba592c9340804fa6',
    });
    stubs.posts.findOne.returns(
      Promise.resolve({
        subtype: '',
        payload: {},
      })
    );
    stubs.posts.findAllReplies.returns(Promise.resolve([{ hash: '0xposthash' }]));

    await controller.getReplies(req, res);

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

    await controller.getReplies(req, res);

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
});
