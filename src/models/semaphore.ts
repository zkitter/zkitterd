import {BIGINT, Sequelize, STRING} from "sequelize";
import {Mutex} from "async-mutex";
import {
    genExternalNullifier,
    genSignalHash,
    setupTree,
    stringifyBigInts,
    unstringifyBigInts,
    verifyProof
} from "libsemaphore";
const snarkjs = require('snarkjs');
import verificationKey from "../../static/verification_key.json";

type SemaphoreModel = {
    id_commitment: string;
    root_hash: string;
    leaf_index: number;
};

const mutex = new Mutex();
let tree: any;

const semaphore = (sequelize: Sequelize) => {
    const model = sequelize.define('semaphore', {
        id_commitment: {
            type: STRING,
            allowNull: false,
            primaryKey: true,
        },
        root_hash: {
            type: STRING,
            allowNull: false,
        },
        leaf_index: {
            type: BIGINT,
            allowNull: false,
        },
    }, {
        indexes: [
            { fields: ['id_commitment'], unique: true },
            { fields: ['root_hash'], unique: true },
            { fields: ['leaf_index'], unique: true },
        ],
    });

    const findOneById = async (id_commitment: string): Promise<SemaphoreModel|null> => {
        let result = await model.findOne({
            where: {
                id_commitment,
            },
        });

        return result?.toJSON() as SemaphoreModel;
    }

    const findOneByHash = async (root_hash: string): Promise<SemaphoreModel|null> => {
        let result = await model.findOne({
            where: {
                root_hash,
            },
        });

        return result?.toJSON() as SemaphoreModel;
    }

    const addID = async (id_commitment: string) => {
        return mutex.runExclusive(async () => {
            await initTree();

            const result = await getPathByID(id_commitment);

            if (result) return result;

            const leaf = await model.findOne({
                order: [['leaf_index', 'DESC']],
                limit: 1,
            });
            const lastLeaf = leaf?.toJSON() as SemaphoreModel;
            const lastIndex = Number(lastLeaf?.leaf_index || -1);
            await tree.update(lastIndex + 1, id_commitment);
            const path = await tree.path(lastIndex + 1);
            const root = path.root;
            await model.create({
                id_commitment,
                root_hash: root,
                leaf_index: lastIndex + 1,
            });
            return path;
        });
    }

    const getPathByID = async (id_commitment: string) => {
        await initTree();
        const leaf = await model.findOne({
            where: {
                id_commitment,
            },
        });
        const lastLeaf = leaf?.toJSON() as SemaphoreModel;

        if (!lastLeaf) return null;

        const path = await tree.path(lastLeaf.leaf_index);
        return path;
    }

    const validateProof = async (hash: string, proof: string, publicSignals: string) => {
        await initTree();
        const parsedProof = unstringifyBigInts(JSON.parse(proof));
        const parsedPublicSignals = unstringifyBigInts(
            JSON.parse(publicSignals)
        );
        const [
            root,
            nullifierHash,
            signalHash,
            externalNullifier,
        ] = parsedPublicSignals as any;

        const verifyingKey = unstringifyBigInts(verificationKey)
        const isProofValid = verifyProof(verifyingKey as any, parsedProof as any, parsedPublicSignals as any);
        const expectedSignalHash = await genSignalHash(Buffer.from(hash, 'hex'));
        const isExternalNullifierValid = snarkjs.bigInt(genExternalNullifier(hash)) === externalNullifier;
        const isSignalHashValid = expectedSignalHash === signalHash;
        const isInRootHistory = await findOneByHash(stringifyBigInts(root) as any);

        if (!isProofValid || !isExternalNullifierValid || !isSignalHashValid || !isInRootHistory) {
            return false;
        }

        return true;
    }

    const initTree = async () => {
        if (tree) return;

        tree = setupTree(20);
        const leaves = await model.findAll({
            order: [['leaf_index', 'ASC']],
        });

        for (const leaf of leaves) {
            const json = leaf.toJSON() as SemaphoreModel;
            await tree.update(json.leaf_index, json.id_commitment);
        }
    }

    return {
        model,
        findOneById,
        findOneByHash,
        addID,
        getPathByID,
        validateProof,
    };
}

export default semaphore;