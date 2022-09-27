import { Sequelize, BIGINT, STRING, QueryTypes } from 'sequelize';
import { Mutex } from 'async-mutex';

type ThreadModel = {
    message_id: string;
    root_id: string;
};

const mutex = new Mutex();

const threads = (sequelize: Sequelize) => {
    const model = sequelize.define(
        'threads',
        {
            message_id: {
                type: STRING,
            },
            root_id: {
                type: STRING,
            },
        },
        {
            indexes: [{ fields: ['root_id', 'message_id'], unique: true }],
        }
    );

    const addThreadData = async (rootId: string, messageId: string) => {
        return mutex.runExclusive(async () => {
            const res = await model.create({
                root_id: rootId,
                message_id: messageId,
            });

            return res;
        });
    };

    const removeThreadData = async (rootId: string, messageId: string) => {
        return mutex.runExclusive(async () => {
            try {
                const res = await model.destroy({
                    where: {
                        root_id: rootId,
                        message_id: messageId,
                    },
                });
                return res;
            } catch (e) {
                return false;
            }
        });
    };

    return {
        model,
        addThreadData,
        removeThreadData,
    };
};

export default threads;
