import {GenericService} from "../util/svc";
import config from "../util/config";
import {BindOrReplacements, Dialect, QueryOptions, QueryTypes, Sequelize} from "sequelize";
import {generateMerkleTree} from "@zk-kit/protocols";

export default class MerkleService extends GenericService {
    sequelize: Sequelize;

    constructor() {
        super();
        if (!config.dbDialect || config.dbDialect === 'sqlite') {
            this.sequelize = new Sequelize({
                dialect: 'sqlite',
                storage: config.dbStorage,
                logging: false,
            });
        } else {
            this.sequelize = new Sequelize(
                config.dbName as string,
                config.dbUsername as string,
                config.dbPassword,
                {
                    host: config.dbHost,
                    port: Number(config.dbPort),
                    dialect: config.dbDialect as Dialect,
                    logging: false,
                },
            );
        }
    }

    findProof = async (proofType: 'rln' | 'semaphore', group: string, idCommitment: string) => {
        const [protocol, groupName, groupType = ''] = group.split('_');
        const protocolBucket = SQL[protocol] || {};
        const groupBucket = protocolBucket[groupName] || {};
        const {sql, replacement} = groupBucket[groupType] || {};

        if (!sql) throw new Error(`${group} does not exist`);

        const options = {
            type: QueryTypes.SELECT,
            replacements: replacement || {},
        };

        const leaves = await this.sequelize.query(sql, options);
        const tree = generateMerkleTree(
            15,
            BigInt(0),
            2,
            leaves.map(({ id_commitment }: any) => '0x' + id_commitment),
        );
        const proof = await tree.createProof(tree.indexOf(BigInt('0x' + idCommitment)));

        if (!proof) throw new Error(`${idCommitment} is not in ${group}`);

        return {
            root: '0x' + proof.root.toString(16),
            siblings: proof.siblings.map((siblings) =>
                Array.isArray(siblings)
                    ? siblings.map((element) => '0x' + element.toString(16))
                    : '0x' + siblings.toString(16)
            ),
            pathIndices: proof.pathIndices,
            leaf: '0x' + proof.leaf.toString(16),
        };
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
};