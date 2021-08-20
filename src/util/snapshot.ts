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
