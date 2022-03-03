import {Sequelize, STRING} from "sequelize";
import {Mutex} from "async-mutex";

type SemaphoreModel = {
    id_commitment: string;
    provider: string;
    name: string;
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
    }, {
        indexes: [
            { fields: ['id_commitment'] },
            { fields: ['provider'] },
            { fields: ['name'] },
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

    const findAllByCommitment = async (id_commitment: string): Promise<SemaphoreModel[]> => {
        let result = await model.findAll({
            where: {
                id_commitment,
            },
        });

        return result.map(r => r.toJSON()) as SemaphoreModel[];
    }

    const addID = async (id_commitment: string, provider: string, name: string) => {
        return mutex.runExclusive(async () => {
            const result = await model.findOne({
                where: {
                    id_commitment,
                    provider,
                    name,
                },
            });

            if (!result) {
                return model.create({
                    id_commitment,
                    provider,
                    name,
                });
            }
        });
    }

    const removeID = async (id_commitment: string, provider: string, name: string) => {
        return mutex.runExclusive(async () => {
            return model.destroy({
                where: {
                    id_commitment,
                    provider,
                    name,
                },
            });
        });
    }

    return {
        model,
        findOneByCommitment,
        findAllByCommitment,
        addID,
        removeID,
    };
}

export default semaphore;