import { IncrementalMerkleTree, MerkleProof } from '@zk-kit/incremental-merkle-tree';
import { generateMerkleTree } from '@zk-kit/protocols';
import { BindOrReplacements, QueryOptions, QueryTypes } from 'sequelize';

import merkleRoot from '@models/merkle_root';
import semaphore from '@models/semaphore';
import { sequelize } from '@util/sequelize';
import { GenericService } from '@util/svc';

export const customGroupSQL = `
    SELECT
        u.name as address,
        name.value as name,
        idcommitment.value as id_commitment 
    FROM users u
    LEFT JOIN profiles name ON name."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'NAME' ORDER BY "createdAt" DESC LIMIT 1)
    JOIN profiles idcommitment ON idcommitment."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'CUSTOM' AND key='id_commitment' ORDER BY "createdAt" DESC LIMIT 1)
       JOIN connections invite ON invite."messageId" = (SELECT "messageId" FROM connections WHERE connections.subtype = 'MEMBER_INVITE' AND connections.creator = :group_address AND connections.name = u.name ORDER BY "createdAt" DESC LIMIT 1)
    JOIN connections accept ON accept."messageId" = (SELECT "messageId" FROM connections WHERE connections.subtype = 'MEMBER_ACCEPT' AND connections.creator = u.name AND connections.name = :group_address ORDER BY "createdAt" DESC LIMIT 1)
`;

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
  interrep: {
    github: {
      bronze: { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
      gold: { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
      silver: { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
      unrated: { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
    },
    reddit: {
      bronze: { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
      gold: { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
      silver: { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
      unrated: { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
    },
    twitter: {
      bronze: { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
      gold: { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
      silver: { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
      unrated: { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
    },
  },
  semaphore: {
    taz: {
      members: { sql: `SELECT id_commitment FROM semaphores WHERE group_id = :group_id` },
    },
  },
  zksocial: {
    all: {
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

export default class MerkleService extends GenericService {
  merkleRoot: ReturnType<typeof merkleRoot>;
  semaphore: ReturnType<typeof semaphore>;

  constructor() {
    super();
    this.merkleRoot = merkleRoot(sequelize);
    this.semaphore = semaphore(sequelize);
  }

  getAllLeaves = async (group: string, offset = 0, limit = 500): Promise<any[]> => {
    const [protocol, groupName, groupType = ''] = group.split('_');
    const protocolBucket = SQL[protocol] || {};
    const groupBucket = protocolBucket[groupName] || {};
    const { replacement, sql } = groupBucket[groupType] || {};
    let query = '';
    const options: QueryOptions = { type: QueryTypes.SELECT };

    if (protocol === 'custom') {
      query = `
        ${customGroupSQL}
        LIMIT :limit OFFSET :offset
      `;
      options.replacements = {
        group_address: groupName,
        limit,
        offset,
      };
    } else {
      query = `
        ${sql}
        LIMIT :limit OFFSET :offset
      `;
      options.replacements = replacement || {
        group_id: group,
        limit,
        offset,
      };
    }

    if (!query) throw new Error(`${group} does not exist`);

    const leaves = await sequelize.query(query, options);
    return leaves as { id_commitment: string }[];
  };

  makeTree = async (
    group: string,
    zkType: 'rln' | 'semaphore' = 'rln'
  ): Promise<IncrementalMerkleTree> => {
    const [protocol, groupName, groupType = ''] = group.split('_');
    const protocolBucket = SQL[protocol] || {};
    const groupBucket = protocolBucket[groupName] || {};
    const { replacement, sql } = groupBucket[groupType] || {};
    let query = '';
    const options: QueryOptions = { type: QueryTypes.SELECT };

    if (protocol === 'custom') {
      query = customGroupSQL;
      options.replacements = {
        group_address: groupName,
      };
    } else {
      query = sql;
      options.replacements = replacement || {
        group_id: group,
      };
    }

    if (!query) throw new Error(`${group} does not exist`);

    const leaves = await sequelize.query(query, options);
    const tree = generateMerkleTree(
      zkType === 'rln' ? 15 : 20,
      BigInt(0),
      leaves.map(({ id_commitment }: any) => '0x' + id_commitment)
    );

    return tree;
  };

  getGroupByRoot = async (root: string): Promise<string | null> => {
    const exist = await this.merkleRoot.getGroupByRoot(root);
    return exist?.group_id || null;
  };

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
  };

  findProof = async (idCommitment: string, group?: string, _proofType?: 'semaphore' | 'rln') => {
    if (!group) {
      const row = await this.semaphore.findOneByCommitment(idCommitment);
      if (!row) throw new Error(`${idCommitment} is not in any groups`);
      group = row.group_id;
    }

    const exist = await this.semaphore.findOne(idCommitment, group);
    const [protocol, service] = group.split('_');

    if (!exist && protocol === 'interrep') {
      await this.call('interrep', 'syncOne', group).catch(() => null);
    }

    const proofType = _proofType ? _proofType : service === 'taz' ? 'semaphore' : 'rln';
    const tree = await this.makeTree(group, proofType);
    const proof = await tree.createProof(tree.indexOf(BigInt('0x' + idCommitment)));

    if (!proof) {
      throw new Error(`${idCommitment} is not in ${group}`);
    }

    const root = '0x' + proof.root.toString(16);

    await this.addRoot(root, group);

    const retProof = {
      group: group,
      leaf: '0x' + proof.leaf.toString(16),
      pathIndices: proof.pathIndices,
      root,
      siblings: proof.siblings.map(siblings =>
        Array.isArray(siblings)
          ? siblings.map(element => '0x' + element.toString(16))
          : '0x' + siblings.toString(16)
      ),
    };

    return retProof;
  };

  addRoot = async (rootHash: string, group: string) => {
    return this.merkleRoot.addRoot(rootHash, group);
  };

  findRoot = async (rootHash: string) => {
    const cached = await this.merkleRoot.getGroupByRoot(rootHash);
    return cached?.group_id;
  };
}
