import tape from 'tape';
import sinon from 'sinon';

import ArbitrumService from './arbitrum';

import { stubCall } from '@util/testUtils';

tape.skip('ArbitrumService', async t => {
  const arb = new ArbitrumService();
  const [, stubs] = stubCall(arb);

  t.equal(
    await arb.getNonce('0x5741cc1bDb03738Eaed6F227E435fc08e6bE157B'),
    '1',
    'get correct nonce'
  );

  const updateFor = sinon.stub(arb.registrar.methods, 'updateFor').returns({ send: () => null });

  const events: any[] = [
    {
      transactionHash: '',
      blockNumber: '',
      returnValues: {
        value:
          '0x616161616161616161616161616161616161616161616161616161616161616161616161616161616161612e61616161616161616161616161616161616161616161616161616161616161616161616161616161616161',
        account: '0xmyuser',
      },
    },
  ];

  await arb.updateFor(
    '0x5741cc1bDb03738Eaed6F227E435fc08e6bE157B',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '0x12345'
  );

  t.deepEqual(
    updateFor.args[0],
    [
      '0x5741cc1bDb03738Eaed6F227E435fc08e6bE157B',
      '0x616161616161616161616161616161616161616161616161616161616161616161616161616161616161612e61616161616161616161616161616161616161616161616161616161616161616161616161616161616161',
      '0x12345',
    ],
    'should send update with correct proof'
  );

  stubs.app.read.returns(
    Promise.resolve({
      lastArbitrumBlockScanned: 2000000,
    })
  );

  sinon.stub(arb.web3.eth, 'getTransaction').returns(Promise.resolve({ hash: '0xtxhash' } as any));
  sinon.stub(arb.web3.eth, 'getBlock').returns(Promise.resolve({ timestamp: 1648624746 } as any));
  sinon.stub(arb.registrar, 'getPastEvents').returns(Promise.resolve(events));

  await arb.scanFromLast();

  t.deepEqual(stubs.users.updateOrCreateUser.args, [
    [
      {
        name: '0xmyuser',
        pubkey:
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        joinedAt: 1648624746000,
        tx: '0xtxhash',
        type: 'arbitrum',
      },
    ],
  ]);

  t.end();
});
