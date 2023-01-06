import tape from 'tape';

import { newRequest, newResponse, stubCall } from '../../../util/testUtils';
import { post } from '../../http/_fixtures';
import { UsersController } from './Users';

let controller: UsersController;
let call: ReturnType<typeof stubCall>[0];
let stubs: ReturnType<typeof stubCall>[1];
let req: ReturnType<typeof newRequest>;
let res: ReturnType<typeof newResponse>;

const init = (...params: Parameters<typeof newRequest>) => {
  controller = new UsersController();
  const stubCallRes = stubCall(controller);
  call = stubCallRes[0];
  stubs = stubCallRes[1];
  req = newRequest(...params);
  res = newResponse();
};

tape('UsersController', t => {
  t.test('GET /v1/users', async t => {
    init();
    stubs.users.readAll.returns(
      Promise.resolve([{ username: '0xuser1' }, { username: '0xuser2' }])
    );
    call.withArgs('ens', 'fetchNameByAddress').returns(Promise.resolve(''));

    await controller.getMany(req, res);

    t.deepEqual(
      stubs.users.readAll.args[0],
      [undefined, 0, 10],
      'should read users db with correct params'
    );
    t.deepEqual(
      res.send.args[0],
      [
        {
          error: undefined,
          payload: [
            { ens: '', username: '0xuser1' },
            { ens: '', username: '0xuser2' },
          ],
        },
      ],
      'should return list of users'
    );
  });

  t.test('GET /v1/users/search/query?', async t => {
    init({ query: '2728' });
    stubs.users.search.returns(
      Promise.resolve([{ username: '0xsearchuser1' }, { username: '0xsearchuser2' }])
    );
    call.withArgs('ens', 'fetchNameByAddress').returns(Promise.resolve(''));

    await controller.search(req, res);

    t.deepEqual(
      stubs.users.search.args[0],
      ['2728', undefined, 0, 10],
      'should search users db with correct params'
    );
    t.deepEqual(
      res.send.args[0],
      [
        {
          error: undefined,
          payload: [
            { ens: '', username: '0xsearchuser1' },
            { ens: '', username: '0xsearchuser2' },
          ],
        },
      ],
      'should return list of users'
    );
  });

  t.test('GET /v1/users/:address', async t => {
    init({ address: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c' });
    stubs.users.findOneByName.returns(
      Promise.resolve({
        username: '0xmyaddress',
      })
    );
    call.withArgs('ens', 'fetchNameByAddress').returns(Promise.resolve(''));

    await controller.getOne(req, res);

    t.deepEqual(
      stubs.users.findOneByName.args[0],
      ['0xd44a82dD160217d46D754a03C8f841edF06EBE3c', undefined],
      'should get user with correct params'
    );
    t.deepEqual(
      res.send.args[0],
      [
        {
          error: undefined,
          payload: {
            address: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
            ens: '',
            username: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
          },
        },
      ],
      'should return user'
    );
  });

  t.test('POST /v1/users', async t => {
    init(null, {
      account: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
      proof: '0xproof',
      publicKey: '0xpubkey',
    });
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

    await controller.addOne(req, res);

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
      [
        'arbitrum',
        'updateFor',
        '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
        '0xpubkey',
        '0xproof',
      ],
      'should call arbitrum contract with correct params'
    );
    t.deepEqual(
      res.send.args[0],
      [
        {
          error: undefined,
          payload: '0xtxhash',
        },
      ],
      'should return tx hash'
    );

    await controller.addOne(newRequest(null, {}), res);
    await controller.addOne(
      newRequest(null, {
        account: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
      }),
      res
    );
    await controller.addOne(
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
  });

  t.test('GET /v1/:user/followers', async t => {
    init();
    const followers = ['0xfoo', '0xbar'];
    stubs.connections.findAllFollowersByName.returns(Promise.resolve(followers));

    await controller.getFollowers(newRequest({ user: '0xr1oga' }, null, null), res);

    t.deepEqual(res.send.args[0][0].payload, followers, 'should return users that follow a user');
  });

  t.test('Get /v1/:user/followings', async t => {
    init();
    const followings = ['0xfoo', '0xbar'];
    stubs.connections.findAllFollowingsByCreator.returns(Promise.resolve(followings));

    await controller.getFollowings(newRequest({ user: '0xr1oga' }, null, null), res);

    t.deepEqual(res.send.args[0][0].payload, followings, 'should return users a user follows');
  });

  t.test('GET /v1/:creator/replies', async t => {
    init({
      creator: '0xmyuser',
    });
    stubs.posts.findAllRepliesFromCreator.returns(Promise.resolve([post]));

    await controller.getReplies(req, res);

    t.deepEqual(
      stubs.posts.findAllRepliesFromCreator.args[0],
      ['0xmyuser', undefined, 0, 10],
      'should find all replies'
    );
    t.deepEqual(
      res.send.args[0],
      [{ error: undefined, payload: [post] }],
      'should return all replies'
    );
  });

  t.test('GET /v1/:creator/likes', async t => {
    init({
      creator: '0xmyuser',
    });
    stubs.posts.findAllLikedPostsByCreator.returns(Promise.resolve([post]));

    await controller.getLikes(req, res);

    t.deepEqual(
      stubs.posts.findAllLikedPostsByCreator.args[0],
      ['0xmyuser', undefined, 0, 10],
      'should find all likes'
    );
    t.deepEqual(
      res.send.args[0],
      [{ error: undefined, payload: [post] }],
      'should return all likes'
    );
  });
});
