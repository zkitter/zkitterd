import 'isomorphic-fetch';
import tape from 'tape';

import ENSService from './ens';

import { stubCall } from '@util/testUtils';

tape.skip('ENSService', async t => {
  const ens = new ENSService();
  const [call, stubs] = stubCall(ens);
  await ens.start();

  t.equal(
    await ens.fetchAddressByName('yagamilight.eth'),
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
    'should get address for yagamilight.eth'
  );

  t.equal(
    await ens.fetchAddressByName('0xd44a82dD160217d46D754a03C8f841edF06EBE3c'),
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
    'should get address for 0xd44a82dD160217d46D754a03C8f841edF06EBE3c'
  );

  t.equal(
    await ens.fetchNameByAddress('0xd44a82dD160217d46D754a03C8f841edF06EBE3c'),
    'yagamilight.eth',
    'should get ens for 0xd44a82dD160217d46D754a03C8f841edF06EBE3c'
  );

  t.equal(
    await ens.fetchNameByAddress('0xd44a82dD160217d46D754a03C8f841edF06EBE3d'),
    null,
    'should get ens for 0xd44a82dD160217d46D754a03C8f841edF06EBE3d'
  );

  t.deepEqual(
    stubs.ens.update.args[0],
    ['yagamilight.eth', '0xd44a82dD160217d46D754a03C8f841edF06EBE3c'],
    'shuld update ens database'
  );

  t.end();
});
