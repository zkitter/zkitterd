export type SnapshotSpace = {
    id: string;
    name: string;
    about: string;
    network: string;
    symbol: string;
    avatar: string;
    members: string[];
    admins: string[];
};

export async function fetchSpace(name: string): Promise<SnapshotSpace|null> {
    // @ts-ignore
    const resp = await fetch('https://hub.snapshot.org/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            query: `
                query {
                    space(id: "${name}") {
                        id
                        name
                        about
                        network
                        symbol
                        members
                        admins
                        avatar
                        strategies {
                          name
                          params
                        }
                    }
                }
           `
        }),
    })

    const json = await resp.json();

    if (!json?.data?.space) {
        return null;
    }

    return json.data.space;
}

export async function fetchProposals(name?: string, offset = 0, limit = 20): Promise<any[]> {
    if (!name) throw new Error('Space id is not defined');

    // @ts-ignore
    const resp = await fetch('https://hub.snapshot.org/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            query: `
                query Proposals {
                    proposals(
                        first: ${limit},
                        skip: ${offset},
                        where: {
                            space_in: ["${name}"]
                        },
                        orderBy: "created",
                        orderDirection: desc
                    ) {
                        id
                        title
                        body
                        choices
                        created
                        start
                        end
                        snapshot
                        state
                        author
                        space {
                            id
                            name
                        }
                    }
                }
           `
        }),
    })

    const json = await resp.json();

    if (!json?.data?.proposals) {
        return [];
    }

    return json.data.proposals;
}

export async function fetchProposal(proposalId?: string, includeVotes = false): Promise<any> {
    if (!proposalId) throw new Error('proposalId is not defined');

    // @ts-ignore
    const resp = await fetch('https://hub.snapshot.org/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            variables: {
                id: proposalId,
            },
            query: `
                query ($id: String!) {
                  proposal(id: $id) {
                    id
                    author
                    body
                    title
                    choices
                    start
                    created
                    end
                    snapshot
                    state
                    network
                    type
                    strategies {
                      name
                      params
                      __typename
                    }
                    space {
                      id
                      name
                      __typename
                    }
                    __typename
                  }
                  ${!includeVotes ? '' : `
                    votes(first: 10000, where: {proposal: $id}) {
                      id
                      voter
                      created
                      choice
                      __typename
                    }
                  `}
                }
           `
        }),
    })

    const json = await resp.json();

    if (includeVotes && !Array.isArray(json.data?.votes)) {
        throw new Error('votes is not an array');
    }

    if (!json.data?.proposal) {
        throw new Error('proposal is not found');
    }

    return json;
}

export async function fetchVotes(proposal: any, votes: any[]): Promise<any> {
    // @ts-ignore
    const resp2 = await fetch(`https://score.snapshot.org/api/scores`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            params: {
                addresses: votes.map((v: any) => v.voter),
                network: proposal.network,
                snapshot: Number(proposal.snapshot),
                space: proposal.space.id,
                strategies: proposal.strategies,
            },
        }),
    })

    const json2 = await resp2.json();
    const [scores] = json2?.result?.scores || [];
    const result: any = [];

    if (!scores) {
        throw new Error('cannot calculate scores');
    }

    for (let vote of votes) {
        const choice = vote.choice - 1;
        const voter = vote.voter;
        result[choice] = result[choice] ? result[choice] + scores[voter] : scores[voter];
        // result.total = result.total ? result.total + scores[voter] : scores[voter];
    }

    return result;
}
