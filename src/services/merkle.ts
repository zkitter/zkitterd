import {GenericService} from "../util/svc";
import {BindOrReplacements, Dialect, QueryTypes, Sequelize} from "sequelize";
import {generateMerkleTree} from "@zk-kit/protocols";
import {MerkleProof, IncrementalMerkleTree} from "@zk-kit/incremental-merkle-tree";
import merkleRoot from "../models/merkle_root";
import {sequelize} from "../util/sequelize";

export default class MerkleService extends GenericService {
    merkleRoot: ReturnType<typeof merkleRoot>;

    constructor() {
        super();
        this.merkleRoot = merkleRoot(sequelize);
    }

    makeTree = async (group: string, zkType: 'rln' | 'semaphore' = 'rln'): Promise<IncrementalMerkleTree> => {
        const [protocol, groupName, groupType = ''] = group.split('_');
        const protocolBucket = SQL[protocol] || {};
        const groupBucket = protocolBucket[groupName] || {};
        const {sql, replacement} = groupBucket[groupType] || {};

        if (!sql) throw new Error(`${group} does not exist`);

        const options = {
            type: QueryTypes.SELECT,
            replacements: replacement || {
                group_id: group,
            },
        };

        const leaves = await sequelize.query(sql, options);
        const tree = generateMerkleTree(
            zkType === 'rln' ? 15 : 20,
            BigInt(0),
            leaves.map(({ id_commitment }: any) => '0x' + id_commitment),
        );

        return tree;
    }

    getGroupByRoot = async (root: string): Promise<string | null> => {
        const exist = await this.merkleRoot.getGroupByRoot(root);
        return exist?.group_id || null;
    }

    verifyProof = async (proof: MerkleProof): Promise<string | null> => {
        const groups = [
            'zksocial_all',
            'interrep_twitter_unrated',
            'interrep_twitter_bronze',
            'interrep_twitter_silver',
            'interrep_twitter_gold',
        ];

        const existingGroup = await this.getGroupByRoot(proof.root);

        if (existingGroup) {
            const tree = await this.makeTree(existingGroup);
            if (tree.verifyProof(proof)) return existingGroup;
        }

        for (const group of groups) {
            const tree = await this.makeTree(group);
            if (tree.verifyProof(proof)) return group;
        }

        return null;
    }

    findProof = async (group: string, idCommitment: string) => {
        const tree = await this.makeTree(group);
        const proof = await tree.createProof(tree.indexOf(BigInt('0x' + idCommitment)));

        if (!proof) throw new Error(`${idCommitment} is not in ${group}`);

        const root = '0x' + proof.root.toString(16);

        await this.addRoot(root, group);

        return {
            root,
            siblings: proof.siblings.map((siblings) =>
                Array.isArray(siblings)
                    ? siblings.map((element) => '0x' + element.toString(16))
                    : '0x' + siblings.toString(16)
            ),
            pathIndices: proof.pathIndices,
            leaf: '0x' + proof.leaf.toString(16),
        };
    }

    addRoot = async (rootHash: string, group: string) => {
        return this.merkleRoot.addRoot(rootHash, group);
    }

    findRoot = async (rootHash: string) => {
        const cached = await this.merkleRoot.getGroupByRoot(rootHash);
        return cached?.group_id;
    }
}

const SQL: {
    [protocol: string]: {
        [groupName: string]: {
            [groupType: string]: {
                sql: string;
                replacement?: BindOrReplacements;
            };
        };
    };
} = {
    'zksocial': {
        'all': {
            '': {
                sql: `
                    SELECT u.name as address, pf.value as id_commitment FROM users u
                    LEFT JOIN profiles pf ON pf."messageId" = (
                        SELECT "messageId" FROM profiles 
                        WHERE creator = u.name AND subtype = 'CUSTOM' 
                        AND key = 'id_commitment' 
                        ORDER BY "createdAt" DESC LIMIT 1
                    )
                    WHERE pf.value IS NOT NULL
                `,
            },
        },
    },
    'interrep': {
        'twitter': {
            'unrated': { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
            'bronze': { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
            'silver': { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
            'gold': { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
        },
        'github': {
            'unrated': { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
            'bronze': { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
            'silver': { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
            'gold': { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
        },
        'reddit': {
            'unrated': { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
            'bronze': { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
            'silver': { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
            'gold': { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
        },
    }
};