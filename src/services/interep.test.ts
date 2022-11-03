import 'isomorphic-fetch';
import tape from 'tape';
import InterrepService from './interrep';
import { stubCall, stubFetch } from '../util/testUtils';
const fetchStub = stubFetch();

const interrep = new InterrepService();

const [callStub, { semaphore, interepGroups }] = stubCall(interrep);

tape('InterepService.start', async (t: any) => {
  const datas = [
    [
      {
        provider: 'twitter',
        name: 'gold',
        depth: 20,
        root: '19217088683336594659449020493828377907203207941212636669271704950158751593251',
        numberOfLeaves: 0,
        size: 0,
      },
      {
        provider: 'poap',
        name: 'devcon5',
        depth: 20,
        root: '19217088683336594659449020493828377907203207941212636669271704950158751593251',
        numberOfLeaves: 0,
        size: 0,
      },
      {
        provider: 'telegram',
        name: '-1001396261340',
        depth: 20,
        root: '19217088683336594659449020493828377907203207941212636669271704950158751593251',
        numberOfLeaves: 0,
        size: 0,
      },
      {
        provider: 'email',
        name: 'hotmail',
        depth: 20,
        root: '19217088683336594659449020493828377907203207941212636669271704950158751593251',
        numberOfLeaves: 0,
        size: 0,
      },
    ],
  ];
  fetchStub.returns(
    Promise.resolve({
      json: async () => {
        return {
          data: datas.shift() || [],
        };
      },
    })
  );

  await interrep.start();

  t.equal(
    fetchStub.args[0][0],
    'https://kovan.interep.link/api/v1/groups',
    'should fetch groups data from interep API on start'
  );

  t.equal(
    fetchStub.args[1][0],
    'https://kovan.interep.link/api/v1/groups/twitter/gold/members?limit=1000&offset=0',
    'should fetch groups membership data from interep API on start'
  );

  fetchStub.reset();

  t.end();
});

// tape('InterepService.addId', async t => {
//     await interrep.addID('0x123456', 'autism', 'gold');
//
//     t.same(
//         semaphore.addID.args[0],
//         ['0x123456', 'autism', 'gold'],
//         'should add new id to semaphore database',
//     );
//
//     semaphore.addID.reset();
//     t.end();
// });
//
// tape('InterepService.removeID', async t => {
//     await interrep.removeID('0x123456', 'autism', 'gold');
//
//     t.same(
//         semaphore.removeID.args[0],
//         ['0x123456', 'autism', 'gold'],
//         'should remove id from semaphore database',
//     );
//     semaphore.removeID.reset();
//     t.end();
// });

tape('InterepService.getBatchFromRootHash', async t => {
  fetchStub.returns(
    Promise.resolve({
      json: async () => ({
        data: {
          group: {
            provider: 'autism',
            name: 'diamond',
          },
        },
      }),
    })
  );

  const res = await interrep.getBatchFromRootHash('0x123456');

  t.same(interepGroups.findOneByHash.args[0], ['0x123456']);
  t.same(fetchStub.args[0][0], 'https://kovan.interep.link/api/v1/batches/0x123456');

  t.same(
    res,
    {
      provider: 'autism',
      name: 'diamond',
      root_hash: '0x123456',
    },
    'should return batch from interep'
  );

  fetchStub.reset();
  interepGroups.findOneByHash.reset();

  t.end();
});

tape('InterepService.getProofFromGroup', async t => {
  fetchStub.returns(
    Promise.resolve({
      json: async () => ({
        data: 'apple',
      }),
    })
  );

  const res = await interrep.getProofFromGroup('0x123456', 'autism', 'diamond');

  t.same(
    fetchStub.args[0][0],
    'https://kovan.interep.link/api/v1/groups/0x123456/autism/diamond/proof'
  );

  t.same(
    res,
    {
      data: 'apple',
    },
    'should return batch from interep'
  );

  fetchStub.reset();

  t.end();
});

tape('InterepService.inProvider', async t => {
  fetchStub.returns(
    Promise.resolve({
      json: async () => ({
        data: 'apple',
      }),
    })
  );

  const res = await interrep.inProvider('autism', '0x123456');

  t.same(fetchStub.args[0][0], 'https://kovan.interep.link/api/v1/providers/autism/0x123456');

  t.equal(res, true);

  fetchStub.reset();

  t.end();
});

// tape('InterepService.scanIDCommitment', async t => {
//     fetchStub.returns(Promise.resolve({
//         json: async () => ({ data: true }),
//     }));
//
//     await interrep.scanIDCommitment('0x123456');
//
//     t.same(
//         fetchStub.args,
//         [
//             [ 'https://kovan.interep.link/api/v1/providers/twitter/0x123456' ],
//             [ 'https://kovan.interep.link/api/v1/groups/twitter/gold/0x123456/proof' ],
//             [ 'https://kovan.interep.link/api/v1/providers/github/0x123456' ],
//             [ 'https://kovan.interep.link/api/v1/providers/reddit/0x123456' ]
//         ],
//     );
//
//     t.same(
//         semaphore.addID.args[0],
//         [ '0x123456', 'twitter', 'gold' ] ,
//     );
//
//     t.notOk(semaphore.removeID.args[0]);
//
//     fetchStub.reset();
//     semaphore.addID.reset();
//
//     let i = true;
//     fetchStub.returns(Promise.resolve({
//         json: async () => {
//             i = !i;
//             return !i ? { data: true }: false;
//         },
//     }));
//
//     await interrep.scanIDCommitment('0x3456789');
//
//     t.same(
//         fetchStub.args,
//         [
//             [ 'https://kovan.interep.link/api/v1/providers/twitter/0x3456789' ],
//             [ 'https://kovan.interep.link/api/v1/groups/twitter/gold/0x3456789/proof' ],
//             [ 'https://kovan.interep.link/api/v1/providers/github/0x3456789' ],
//             [ 'https://kovan.interep.link/api/v1/providers/reddit/0x3456789' ]
//         ],
//     );
//
//     t.notOk(semaphore.addID.args[0]);
//     t.same(
//         semaphore.removeID.args[0],
//         [ '0x3456789', 'twitter', 'gold' ] ,
//     );
//
//     fetchStub.reset();
//
//     t.end();
// });
