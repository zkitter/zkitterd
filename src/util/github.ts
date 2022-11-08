import config from '../util/config';

const request = async (data: any) =>
  (
    await fetch('https://api.github.com/graphql', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        Authorization: `Bearer ${process.env.GH_PAT}`,
        'Content-Type': 'application/json',
      },
    })
  ).json();

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

// @ts-ignore
export const getRepos = async (username: string, after = null) =>
  request({ query, variables: { username, after } });

/**
 * Aggregate the number of stars received by one user over all its repos. Required to calculate interep reputation.
 * {@link https://docs.interep.link/technical-reference/reputation/github}
 * @param username
 */
export const getReceivedStars = async (username: string): Promise<number> => {
  let nodes = [];
  let hasNextPage = true;
  let endCursor = null;

  while (hasNextPage) {
    // @ts-ignore
    let res = await getRepos(username, endCursor);
    const allNodes = res.data.user.repositories.nodes;
    // @ts-ignore
    const nodesWithStars = allNodes.filter(node => node.stargazers.totalCount !== 0);
    nodes.push(...nodesWithStars);

    hasNextPage = res.data.user.repositories.pageInfo.hasNextPage;
    endCursor = res.data.user.repositories.pageInfo.endCursor;
  }

  return nodes.reduce((prev, curr) => prev + curr.stargazers.totalCount, 0);
};
