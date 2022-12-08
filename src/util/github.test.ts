import tape from 'tape';
import { getReceivedStars, getRepos } from './github';
import { stubFetch } from './testUtils';

tape('util/github.ts', async t => {
  const fetchStub = stubFetch();

  t.test('getRepos', async t => {
    fetchStub.resolves({ json: async () => ({ data: { user: { repositories: ['repo'] } } }) });
    const repos = await getRepos('foo');

    t.equal(
      fetchStub.args[0][0],
      'https://api.github.com/graphql',
      'request token from github graphql api'
    );
    t.deepEqual(repos, ['repo'], 'return repos list');

    fetchStub.reset();
  });

  t.test('getStars', async t => {
    fetchStub.resolves({
      json: async () => ({
        data: {
          user: {
            repositories: {
              nodes: [{ stargazers: { totalCount: 1 } }, { stargazers: { totalCount: 1 } }],
              pageInfo: { hasNextPage: false },
            },
          },
        },
      }),
    });

    const stars = await getReceivedStars('r1oga');
    t.equals(stars, 2, 'return aggregated number of stars of a user');

    fetchStub.reset();
  });
});
