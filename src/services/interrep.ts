import {GenericService} from "../util/svc";
import config from "../util/config";

export type InterepGroup = {
    provider: 'twitter' | 'github' | 'reddit';
    name: string;
    rootHash: string;
    size: number;
}

export default class InterrepService extends GenericService {
    groups: {
        [providerName: string]: InterepGroup[],
    };

    providers = ['twitter', 'github', 'reddit'];

    constructor() {
        super();
        this.groups = {};
    }

    async fetchGroups() {
        // @ts-ignore
        const resp = await fetch(`${config.interrepAPI}/api/v1/groups`);
        const json = await resp.json();

        if (json?.data?.length) {
            for (let group of json.data) {
                if (this.providers.includes(group.provider)) {
                    const bucket = this.groups[group.provider] || [];
                    bucket.push(group);
                    this.groups[group.provider] = bucket;
                }
            }
        }
    }

    async addID(id_commitment: string, provider: string, name: string) {
        const semaphore = await this.call('db', 'getSemaphore');
        await semaphore.addID(id_commitment, provider, name);
    }

    async removeID(id_commitment: string, provider: string, name: string) {
        const semaphore = await this.call('db', 'getSemaphore');
        await semaphore.removeID(id_commitment, provider, name);
    }

    async scanIDCommitment(id: string) {
        for (let provider of this.providers) {
            if (await this.inProvider(provider, id)) {
                const groups = this.groups[provider];

                if (groups) {
                    for (let group of groups) {
                        const proof = await this.getProofFromGroup(provider, group.name, id);
                        if (proof) {
                            await this.addID(id, provider, group.name);
                        } else {
                            await this.removeID(id, provider, group.name);
                        }
                    }
                }
            }
        }
    }

    async getBatchFromRootHash(rootHash: string) {
        try {
            const interepGroups = await this.call('db', 'getInterepGroups');

            const exist = await interepGroups.findOneByHash(rootHash);

            if (exist) return exist;

            // @ts-ignore
            const resp = await fetch(`${config.interrepAPI}/api/trees/batches/${rootHash}`);
            const json = await resp.json();
            const group = json?.data?.group;

            if (group) {
                await interepGroups.addHash(rootHash, group.provider, group.name);
            }

            return {
                name: group.name,
                provider: group.provider,
                root_hash: rootHash,
            };
        } catch (e) {
            return false;
        }
    }

    async getProofFromGroup(provider: string, name: string, id: string) {
        try {
            // @ts-ignore
            const resp = await fetch(`${config.interrepAPI}/api/v1/groups/${provider}/${name}/${id}/proof`);
            const json = await resp.json();
            return json;
        } catch (e) {
            return false;
        }
    }

    async inProvider(provider: string, id: string): Promise<boolean> {
        // @ts-ignore
        const resp = await fetch(`${config.interrepAPI}/api/v1/providers/${provider}/${id}`);
        const json = await resp.json();

        if (json?.data) {
            return !!json?.data;
        }

        return false;
    }

    async start() {
        await this.fetchGroups();
    }
}