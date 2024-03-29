import { Semaphore } from '@zk-kit/protocols';
import sinon from 'sinon';
import tape from 'tape';

import { stubCall, stubFetch } from '@util/testUtils';

import GunService from './gun';

const fetchStub = stubFetch();

const verifyProofStub = sinon.stub(Semaphore, 'verifyProof').returns(Promise.resolve(true));

tape('GunService - insert a post', async t => {
  const gun = new GunService();
  // @ts-expect-error
  gun.gun = { get: sinon.stub() };
  const [, stubs] = stubCall(gun);

  stubs.users.findOneByPubkey.returns(
    Promise.resolve({
      name: '0xmockuser',
      type: 'arbitrum',
    })
  );

  // @ts-expect-error
  gun.gun.get.returns(
    Promise.resolve({
      content: 'hello world!',
      title: 'unit test post',
      topic: 'unitest',
    })
  );

  await gun.handleGunMessage(
    {
      createdAt: 1648591319888,
      payload: {
        '#': '_id',
      },
      subtype: '',
      type: 'POST',
    },
    '0xmockuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'
  );

  t.deepEqual(
    stubs.posts.findOne.args[0],
    ['1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'],
    'should use correct hash'
  );

  t.deepEqual(
    stubs.posts.createPost.args[0],
    [
      {
        attachment: '',
        content: 'hello world!',
        createdAt: 1648591319888,
        creator: '0xmockuser',
        hash: '1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501',
        messageId: '0xmockuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501',
        proof: undefined,
        reference: '',
        signals: undefined,
        subtype: '',
        title: 'unit test post',
        topic: 'unitest',
        type: 'POST',
      },
    ],
    'should create post'
  );

  t.deepEqual(
    stubs.threads.addThreadData.args[0],
    [
      '0xmockuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501',
      '0xmockuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501',
    ],
    'should add thread data'
  );

  t.equal(stubs.userMeta.addPostingCount.args[0][0], '0xmockuser', 'should add posting count');

  t.end();
});

tape('GunService - insert an anon post', async t => {
  const gun = new GunService();
  // @ts-expect-error
  gun.gun = { get: sinon.stub() };
  const [callStub, stubs] = stubCall(gun);

  callStub.withArgs('zkchat', 'verifyRLNProof').returns(Promise.resolve(true));
  callStub.withArgs('zkchat', 'checkShare').returns(Promise.resolve({}));
  callStub.withArgs('merkle', 'getGroupByRoot').returns(Promise.resolve('test_test'));
  callStub.withArgs('interrep', 'getBatchFromRootHash').returns(
    Promise.resolve({
      name: 'gold',
      provider: 'twitter',
    })
  );

  stubs.users.findOneByPubkey.returns(
    Promise.resolve({
      name: '0xmockuser',
      type: 'arbitrum',
    })
  );

  // @ts-expect-error
  gun.gun.get.returns(
    Promise.resolve({
      content: 'asdf',
    })
  );

  await gun.handleGunMessage(
    {
      createdAt: 1659741179034,
      payload: {
        '#': '_id',
      },
      proof:
        '{"pi_a":["10719373609680523485982312021646907110391592138267365521057142291191547653652","20889338013517845688726590862322915124049598328032969705161037916987649952972","1"],"pi_b":[["17991725371095382156928055899575073985240148184758790083942336263151354846252","1657664999162981395538901245632927690612273274856299328343199536743784155792"],["17325778964762002770606313427657139034069790547992386601106767917330439219030","19416397159649010876162621414769410299499393845713504422953930764881902338641"],["1","0"]],"pi_c":["17716869430758995796768492072228886076409298777156054528359501944105105396698","15918925710228209087156922486463196421892681140566259906347478528341362237104","1"],"protocol":"groth16","curve":"bn128"}',
      publicSignals:
        '{"yShare":"2596566450929043962761450092440142049519799633581076804768430467675269221368","merkleRoot":"21137000379541905758810616775680635874157808693894963417588670647874638987193","internalNullifier":"3249285416939345894614550347931138631805524933300401461693856407745800741248","signalHash":"322102638286753199086387914380100501154901403315461095472159328444195830498","epoch":"4022355745804610470485496540678469237263368715338490843445638578102916","rlnIdentifier":"58251097131773823298631486024345026366590187448202619704133287740687112771558"}',
      subtype: '',
      type: 'POST',
      x_share: '322102638286753199086387914380100501154901403315461095472159328444195830498',
    },
    '334bf9fd2507878e566bd7805c46aab513a4e42cc5d1fb8e66f57e8864f50003'
  );

  t.deepEqual(
    stubs.posts.findOne.args[0],
    ['334bf9fd2507878e566bd7805c46aab513a4e42cc5d1fb8e66f57e8864f50003'],
    'should use correct hash'
  );

  t.deepEqual(
    stubs.posts.createPost.args[0],
    [
      {
        attachment: '',
        content: 'asdf',
        createdAt: 1659741179034,
        creator: '',
        hash: '334bf9fd2507878e566bd7805c46aab513a4e42cc5d1fb8e66f57e8864f50003',
        messageId: '334bf9fd2507878e566bd7805c46aab513a4e42cc5d1fb8e66f57e8864f50003',
        proof:
          '{"pi_a":["10719373609680523485982312021646907110391592138267365521057142291191547653652","20889338013517845688726590862322915124049598328032969705161037916987649952972","1"],"pi_b":[["17991725371095382156928055899575073985240148184758790083942336263151354846252","1657664999162981395538901245632927690612273274856299328343199536743784155792"],["17325778964762002770606313427657139034069790547992386601106767917330439219030","19416397159649010876162621414769410299499393845713504422953930764881902338641"],["1","0"]],"pi_c":["17716869430758995796768492072228886076409298777156054528359501944105105396698","15918925710228209087156922486463196421892681140566259906347478528341362237104","1"],"protocol":"groth16","curve":"bn128"}',
        reference: '',
        signals:
          '{"yShare":"2596566450929043962761450092440142049519799633581076804768430467675269221368","merkleRoot":"21137000379541905758810616775680635874157808693894963417588670647874638987193","internalNullifier":"3249285416939345894614550347931138631805524933300401461693856407745800741248","signalHash":"322102638286753199086387914380100501154901403315461095472159328444195830498","epoch":"4022355745804610470485496540678469237263368715338490843445638578102916","rlnIdentifier":"58251097131773823298631486024345026366590187448202619704133287740687112771558"}',
        subtype: '',
        title: '',
        topic: '',
        type: 'POST',
      },
    ],
    'should create post'
  );

  t.deepEqual(
    stubs.threads.addThreadData.args[0],
    [
      '334bf9fd2507878e566bd7805c46aab513a4e42cc5d1fb8e66f57e8864f50003',
      '334bf9fd2507878e566bd7805c46aab513a4e42cc5d1fb8e66f57e8864f50003',
    ],
    'should add thread data'
  );

  t.deepEqual(
    stubs.semaphoreCreators.addSemaphoreCreator.args[0],
    ['334bf9fd2507878e566bd7805c46aab513a4e42cc5d1fb8e66f57e8864f50003', 'test', undefined],
    'should add semaphore creator'
  );

  verifyProofStub.reset();
  t.end();
});

tape('GunService - insert a reply', async t => {
  const gun = new GunService();
  // @ts-expect-error
  gun.gun = { get: sinon.stub() };
  const [callStub, stubs] = stubCall(gun);

  callStub.withArgs('ens', 'fetchAddressByName').returns(Promise.resolve('0x123456'));

  stubs.users.findOneByPubkey.returns(
    Promise.resolve({
      name: '0xreplyuser',
      type: 'arbitrum',
    })
  );

  // @ts-expect-error
  gun.gun.get.returns(
    Promise.resolve({
      attachment: '',
      content: 'hello world! #reply @0x123456',
      reference: '0x123/a1f3a12fbeb7f8087cec3be9252e2dc4859100dbdb77dd8a2816678dc17b1238',
      title: 'unit test reply',
      topic: 'reply',
    })
  );

  stubs.posts.findRoot.returns(Promise.resolve('ROOT'));

  await gun.handleGunMessage(
    {
      createdAt: 1648591319888,
      payload: {
        '#': '_id',
      },
      subtype: 'REPLY',
      type: 'POST',
    },
    '0xreplyuser/a1f3a12fbeb7f8087cec3be9252e2dc4859100dbdb77dd8a2816678dc17b1238'
  );

  t.deepEqual(
    stubs.posts.findOne.args[0],
    ['d8064c6026b7f01bf3a8162a63ea2f4f1d7aaa8d935c35cd60913f8950a8cfa3'],
    'should use correct hash'
  );

  t.deepEqual(
    stubs.posts.createPost.args[0],
    [
      {
        attachment: '',
        content: 'hello world! #reply @0x123456',
        createdAt: 1648591319888,
        creator: '0xreplyuser',
        hash: 'd8064c6026b7f01bf3a8162a63ea2f4f1d7aaa8d935c35cd60913f8950a8cfa3',
        messageId: '0xreplyuser/d8064c6026b7f01bf3a8162a63ea2f4f1d7aaa8d935c35cd60913f8950a8cfa3',
        proof: undefined,
        reference: '0x123/a1f3a12fbeb7f8087cec3be9252e2dc4859100dbdb77dd8a2816678dc17b1238',
        signals: undefined,
        subtype: 'REPLY',
        title: 'unit test reply',
        topic: 'reply',
        type: 'POST',
      },
    ],
    'should create post'
  );

  t.deepEqual(
    stubs.threads.addThreadData.args[0],
    ['ROOT', '0xreplyuser/d8064c6026b7f01bf3a8162a63ea2f4f1d7aaa8d935c35cd60913f8950a8cfa3'],
    'should add thread data'
  );

  t.deepEqual(
    stubs.tags.addTagPost.args[0],
    ['#reply', '0xreplyuser/d8064c6026b7f01bf3a8162a63ea2f4f1d7aaa8d935c35cd60913f8950a8cfa3'],
    'should add hash tags'
  );

  t.deepEqual(stubs.meta.addPost.args[0], ['#reply'], 'should add post counts to hash tag');

  t.deepEqual(
    stubs.tags.addTagPost.args[1],
    ['@0x123456', '0xreplyuser/d8064c6026b7f01bf3a8162a63ea2f4f1d7aaa8d935c35cd60913f8950a8cfa3'],
    'should add mentions'
  );

  t.deepEqual(
    stubs.userMeta.addMentionedCount.args[0],
    ['0x123456'],
    'should add mentioned counts to user meta'
  );

  t.end();
});

tape('GunService - insert a moderation', async t => {
  const gun = new GunService();
  // @ts-expect-error
  gun.gun = { get: sinon.stub() };
  const [, stubs] = stubCall(gun);

  stubs.users.findOneByPubkey.returns(
    Promise.resolve({
      name: '0xmockuser',
      type: 'arbitrum',
    })
  );

  // @ts-expect-error
  gun.gun.get.returns(
    Promise.resolve({
      reference: '0x123/3456',
    })
  );

  await gun.handleGunMessage(
    {
      createdAt: 1648591319888,
      payload: {
        '#': '_id',
      },
      subtype: 'LIKE',
      type: 'MODERATION',
    },
    '0xmockuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'
  );

  t.deepEqual(
    stubs.moderations.findOne.args[0],
    ['edaeea596a25b2df34f24a6b8d5a746957e8e0f5c184c924cc52a606852effa7'],
    'should use correct hash'
  );

  t.equal(stubs.posts.ensurePost.args[0][0], '0x123/3456', 'should ensure post');

  t.deepEqual(
    stubs.moderations.createModeration.args[0],
    [
      {
        createdAt: 1648591319888,
        creator: '0xmockuser',
        hash: 'edaeea596a25b2df34f24a6b8d5a746957e8e0f5c184c924cc52a606852effa7',
        messageId: '0xmockuser/edaeea596a25b2df34f24a6b8d5a746957e8e0f5c184c924cc52a606852effa7',
        reference: '0x123/3456',
        subtype: 'LIKE',
        type: 'MODERATION',
      },
    ],
    'should create moderation'
  );

  t.deepEqual(stubs.meta.addLike.args[0], ['0x123/3456'], 'should add like counts');

  t.end();
});

tape('GunService - insert a connection', async t => {
  const gun = new GunService();
  // @ts-expect-error
  gun.gun = { get: sinon.stub() };
  const [, stubs] = stubCall(gun);

  stubs.users.findOneByPubkey.returns(
    Promise.resolve({
      name: '0xmockuser',
      type: 'arbitrum',
    })
  );

  // @ts-expect-error
  gun.gun.get.returns(
    Promise.resolve({
      name: '0xotheruser',
    })
  );

  await gun.handleGunMessage(
    {
      createdAt: 1648591319888,
      payload: {
        '#': '_id',
      },
      subtype: 'FOLLOW',
      type: 'CONNECTION',
    },
    '0xmockuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'
  );

  t.deepEqual(
    stubs.connections.findOne.args[0],
    ['82d5f06010f32aadfc8953c0491b726ae14c3e0d9690bd736ee0c31bdc9ddae1'],
    'should use correct hash'
  );

  t.equal(stubs.users.ensureUser.args[0][0], '0xotheruser', 'should ensure user');

  t.deepEqual(
    stubs.connections.createConnection.args[0],
    [
      {
        createdAt: 1648591319888,
        creator: '0xmockuser',
        hash: '82d5f06010f32aadfc8953c0491b726ae14c3e0d9690bd736ee0c31bdc9ddae1',
        messageId: '0xmockuser/82d5f06010f32aadfc8953c0491b726ae14c3e0d9690bd736ee0c31bdc9ddae1',
        name: '0xotheruser',
        subtype: 'FOLLOW',
        type: 'CONNECTION',
      },
    ],
    'should create connections'
  );

  t.deepEqual(stubs.userMeta.addFollower.args[0], ['0xotheruser'], 'should add like counts');

  t.deepEqual(stubs.userMeta.addFollowing.args[0], ['0xmockuser'], 'should add like counts');

  t.end();
});

tape('GunService - insert a profile', async t => {
  const gun = new GunService();
  // @ts-expect-error
  gun.gun = { get: sinon.stub() };
  const [, stubs] = stubCall(gun);

  stubs.users.findOneByPubkey.returns(
    Promise.resolve({
      name: '0xmockuser',
      type: 'arbitrum',
    })
  );

  // @ts-expect-error
  gun.gun.get.returns(
    Promise.resolve({
      key: 'twitter_user_handle',
      value: 'wowow',
    })
  );

  fetchStub.returns(
    Promise.resolve({
      json: async () => ({
        entities: { urls: [{ expanded_url: ['0xmockuser'] }] },
        user: { screen_name: 'twitter_user_handle' },
      }),
      status: 200,
    })
  );

  await gun.handleGunMessage(
    {
      createdAt: 1648591319888,
      payload: {
        '#': '_id',
      },
      subtype: 'TWT_VERIFICATION',
      type: 'PROFILE',
    },
    '0xmockuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'
  );

  t.deepEqual(
    stubs.profiles.findOne.args[0],
    ['c5308a456cc7ac29d050bcb5f25230b0bcf537a76969aa69d25b4889e50eb751'],
    'should use correct hash'
  );

  t.deepEqual(
    stubs.twitterAuths.addAccount.args[0],
    ['twitter_user_handle', '0xmockuser'],
    'should add new twitter account'
  );

  t.deepEqual(
    stubs.profiles.createProfile.args[0],
    [
      {
        createdAt: 1648591319888,
        creator: '0xmockuser',
        hash: 'c5308a456cc7ac29d050bcb5f25230b0bcf537a76969aa69d25b4889e50eb751',
        key: 'twitter_user_handle',
        messageId: '0xmockuser/c5308a456cc7ac29d050bcb5f25230b0bcf537a76969aa69d25b4889e50eb751',
        subtype: 'TWT_VERIFICATION',
        type: 'PROFILE',
        value: 'wowow',
      },
    ],
    'should create profile'
  );

  fetchStub.reset();
  t.end();
});

tape('GunService - delete post', async t => {
  const gun = new GunService();
  // @ts-expect-error
  gun.gun = { get: sinon.stub() };
  const [callStub, stubs] = stubCall(gun);

  callStub.withArgs('ens', 'fetchAddressByName').returns(Promise.resolve('0xmentionuser'));

  stubs.users.findOneByPubkey.returns(
    Promise.resolve({
      name: '0xmyuser',
      type: 'arbitrum',
    })
  );

  stubs.posts.findOne.returns(
    Promise.resolve({
      creator: '0xmyuser',
      payload: {
        content: '@0xmentionuser #hashtag',
      },
      subtype: '',
    })
  );

  await gun.handleGunMessage(
    null,
    '0xmyuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'
  );

  t.deepEqual(
    stubs.tags.removeTagPost.args[0],
    ['#hashtag', '0xmyuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'],
    'should remove following meta'
  );

  t.deepEqual(
    stubs.tags.removeTagPost.args[1],
    ['@0xmentionuser', '0xmyuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'],
    'should remove following meta'
  );

  t.deepEqual(
    stubs.userMeta.removeMentionedCount.args[0],
    ['0xmentionuser'],
    'should remove following meta'
  );

  t.deepEqual(stubs.meta.removePost.args[0], ['#hashtag'], 'should remove follower meta');

  t.deepEqual(
    stubs.posts.remove.args[0],
    ['1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'],
    'should remove follower meta'
  );

  t.end();
});

tape('GunService - delete moderation', async t => {
  const gun = new GunService();
  // @ts-expect-error
  gun.gun = { get: sinon.stub() };
  const [, stubs] = stubCall(gun);

  stubs.users.findOneByPubkey.returns(
    Promise.resolve({
      name: '0xmockuser',
      type: 'arbitrum',
    })
  );

  stubs.moderations.findOne.returns(
    Promise.resolve({
      reference: '0xotheruser/posthash',
      subtype: 'LIKE',
    })
  );

  await gun.handleGunMessage(
    null,
    '0xmockuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'
  );

  t.deepEqual(
    stubs.meta.removeLike.args[0],
    ['0xotheruser/posthash'],
    'should remove follower meta'
  );

  t.deepEqual(
    stubs.moderations.remove.args[0],
    ['1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'],
    'should remove connection'
  );

  t.end();
});

tape('GunService - delete connections', async t => {
  const gun = new GunService();
  // @ts-expect-error
  gun.gun = { get: sinon.stub() };
  const [, stubs] = stubCall(gun);

  stubs.users.findOneByPubkey.returns(
    Promise.resolve({
      name: '0xmockuser',
      type: 'arbitrum',
    })
  );

  stubs.connections.findOne.returns(
    Promise.resolve({
      creator: '0xmyuser',
      name: '0xotheruser',
      subtype: 'FOLLOW',
    })
  );

  await gun.handleGunMessage(
    null,
    '0xmockuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'
  );

  t.deepEqual(stubs.userMeta.removeFollowing.args[0], ['0xmyuser'], 'should remove following meta');

  t.deepEqual(
    stubs.userMeta.removeFollower.args[0],
    ['0xotheruser'],
    'should remove follower meta'
  );

  t.deepEqual(
    stubs.connections.remove.args[0],
    ['1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'],
    'should remove connection'
  );

  t.end();
});

tape('GunService - delete profile', async t => {
  const gun = new GunService();
  // @ts-expect-error
  gun.gun = { get: sinon.stub() };
  const [, stubs] = stubCall(gun);

  stubs.users.findOneByPubkey.returns(
    Promise.resolve({
      name: '0xmockuser',
      type: 'arbitrum',
    })
  );

  stubs.profiles.findOne.returns(
    Promise.resolve({
      key: 'hi',
      value: 'world',
    })
  );

  await gun.handleGunMessage(
    null,
    '0xmockuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'
  );

  t.deepEqual(
    stubs.profiles.remove.args[0],
    ['1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'],
    'should remove connection'
  );

  t.end();
});
