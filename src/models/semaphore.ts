import {Sequelize, STRING} from "sequelize";
import {Mutex} from "async-mutex";

type SemaphoreModel = {
    id_commitment: string;
    group_id: string;
    root_hash: string;
};

const mutex = new Mutex();

const semaphore = (sequelize: Sequelize) => {
    const model = sequelize.define('semaphore', {
        id_commitment: {
            type: STRING,
            allowNull: false,
        },
        group_id: {
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
            { fields: ['group_id'] },
            { fields: ['root_hash'] },
        ],
    });

    const findOneByCommitment = async (id_commitment: string): Promise<SemaphoreModel|null> => {
        let result = await model.findOne({
            where: {
                id_commitment,
            },
            order: [
                ['createdAt', 'DESC'],
            ],
        });

        return result?.toJSON() as SemaphoreModel;
    }

    const findOne = async (id_commitment: string, group_id: string): Promise<SemaphoreModel|null> => {
        let result = await model.findOne({
            where: {
                id_commitment,
                group_id,
            },
            order: [
                ['createdAt', 'DESC'],
            ],
        });

        return result?.toJSON() as SemaphoreModel;
    }

    const findAllByCommitment = async (id_commitment: string): Promise<SemaphoreModel[]> => {
        let result = await model.findAll({
            where: {
                id_commitment,
            },
        });

        return result.map(r => r.toJSON()) as SemaphoreModel[];
    }

    const addID = async (id_commitment: string, group_id: string, root_hash: string) => {
        return mutex.runExclusive(async () => {
            const result = await model.findOne({
                where: {
                    id_commitment,
                    group_id,
                },
            });

            if (!result) {
                return model.create({
                    id_commitment,
                    group_id,
                    root_hash,
                });
            } else {
                return result.update({ root_hash });
            }
        });
    }

    const removeID = async (id_commitment: string, group_id: string, root_hash: string) => {
        return mutex.runExclusive(async () => {
            return model.destroy({
                where: {
                    id_commitment,
                    group_id,
                    root_hash,
                },
            });
        });
    }

    return {
        model,
        findOne,
        findOneByCommitment,
        findAllByCommitment,
        addID,
        removeID,
    };
}

export default semaphore;