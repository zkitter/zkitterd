import {Sequelize, BIGINT, STRING, QueryTypes} from "sequelize";
import {Mutex} from "async-mutex";

type SemaphoreCreatorModel = {
    message_id: string;
    provider: string;
    group: string;
};

const mutex = new Mutex();

const semaphoreCreators = (sequelize: Sequelize) => {
    const model = sequelize.define('semaphore_creators', {
        group: {
            type: STRING,
        },
        provider: {
            type: STRING,
        },
        message_id: {
            type: STRING,
        },
    }, {
        indexes: [
            { fields: ['provider'] },
            { fields: ['group'] },
            { fields: ['message_id'], unique: true },
        ],
    });

    const addSemaphoreCreator = async (messageId: string, provider: string, group: string) => {
        return mutex.runExclusive(async () => {
            const res = await model.create({
                provider: provider,
                group: group,
                message_id: messageId,
            });

            return res;
        });
    }

    return {
        model,
        addSemaphoreCreator,
    };
}

export default semaphoreCreators;