import {Sequelize, STRING} from "sequelize";
import {Mutex} from "async-mutex";

type SemaphoreModel = {
    id_commitment: string;
    root_hash: string;
};

const mutex = new Mutex();

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
    }, {
        indexes: [
            { fields: ['id_commitment'], unique: true },
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

    const addID = async (id_commitment: string, root_hash: string) => {
        return mutex.runExclusive(async () => {
            return model.create({
                id_commitment,
                root_hash,
            });
        });
    }

    return {
        model,
        findOneByHash,
        addID,
    };
}

export default semaphore;