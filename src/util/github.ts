import config from './config';

type Node = { stargazers: { totalCount: number } };
type Repositories = {
  nodes: Node[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string;
  };
};

const request = async (data: any): Promise<Repositories> =>
  fetch('https://api.github.com/graphql', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: {
      Authorization: `Bearer ${config.ghPat}`,
      'Content-Type': 'application/json',
    },
  }).then(res => res.json().then(res => res.data.user.repositories));

const query = `
      query userInfo($username: String!, $after: String) {
        user(login: $username) {
          repositories(first: 100, ownerAffiliations: OWNER, orderBy: {direction: DESC, field: STARGAZERS}, after: $after) {
            nodes {
              name
              stargazers {
                totalCount
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
      `;

export const getRepos = async (username: string, after: string | null = null) =>
  request({ query, variables: { username, after } });

/**
 * Aggregate the number of stars received by one user over all its repos. Required to calculate interep reputation.
 * {@link https://docs.interep.link/technical-reference/reputation/github}
 * @param username
 */
export const getReceivedStars = async (username: string): Promise<number> => {
  const nodes = [];
  let hasNextPage = true;
  let endCursor = null;

  while (hasNextPage) {
    const repositories: Repositories = await getRepos(username, endCursor);
    const allNodes = repositories.nodes;
    const nodesWithStars = allNodes.filter(node => node.stargazers.totalCount !== 0);

    nodes.push(...nodesWithStars);

    hasNextPage = repositories.pageInfo.hasNextPage;
    endCursor = repositories.pageInfo.endCursor;
  }

  return nodes.reduce((prev, curr) => prev + curr.stargazers.totalCount, 0);
};
