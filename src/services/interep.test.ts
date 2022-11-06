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

  // FIXME
  // t.equal(
  //   fetchStub.args[1][0],
  //   'https://kovan.interep.link/api/v1/groups/twitter/gold/members?limit=1000&offset=0',
  //   'should fetch groups membership data from interep API on start'
  // );

  fetchStub.reset();
});

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
  // FIXME
  // t.same(fetchStub.args[0][0], 'https://kovan.interep.link/api/v1/batches/0x123456');

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
});
