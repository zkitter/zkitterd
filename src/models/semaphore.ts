import {Sequelize, STRING} from "sequelize";
import {Mutex} from "async-mutex";

type SemaphoreModel = {
    id_commitment: string;
    provider: string;
    name: string;
    root_hash: string;
};

const mutex = new Mutex();

const semaphore = (sequelize: Sequelize) => {
    const model = sequelize.define('semaphore', {
        id_commitment: {
            type: STRING,
            allowNull: false,
        },
        provider: {
            type: STRING,
            allowNull: false,
        },
        name: {
            type: STRING,
            allowNull: false,
        },
        root_hash: {
            type: STRING,
            allowNull: false,
        },
    }, {
        indexes: [
            { fields: ['id_commitment'] },
            { fields: ['provider'] },
            { fields: ['name'] },
            { fields: ['root_hash'], unique: true },
        ],
    });

    const findOneByHash = async (root_hash: string): Promise<SemaphoreModel|null> => {
        let result = await model.findOne({
            where: {
                root_hash,
            },
        });

        return result?.toJSON() as SemaphoreModel;
    }

    const findOneByCommitment = async (id_commitment: string): Promise<SemaphoreModel|null> => {
        let result = await model.findOne({
            where: {
                id_commitment,
            },
        });

        return result?.toJSON() as SemaphoreModel;
    }

    const addID = async (id_commitment: string, provider: string, name: string, root_hash: string) => {
        return mutex.runExclusive(async () => {
            return model.create({
                id_commitment,
                provider,
                name,
                root_hash,
            });
        });
    }

    return {
        model,
        findOneByHash,
        findOneByCommitment,
        addID,
    };
}

export default semaphore;