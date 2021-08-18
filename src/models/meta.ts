import {BIGINT, Sequelize, STRING} from "sequelize";
import {Mutex} from "async-mutex";

type MetaModel = {
    messageId: string;
    replyCount: number;
    likeCount: number;
    repostCount: number;
};

const mutex = new Mutex();

const meta = (sequelize: Sequelize) => {
    const model = sequelize.define('meta', {
        messageId: {
            type: STRING,
            allowNull: false,
            primaryKey: true,
        },
        replyCount: {
            type: BIGINT,
        },
        likeCount: {
            type: BIGINT,
        },
        repostCount: {
            type: BIGINT,
        },
    }, {
        indexes: [
            { fields: ['messageId'], unique: true },
        ],
    });

    const findOne = async (hash: string): Promise<MetaModel|null> => {
        let result = await model.findOne({
            where: {
                hash,
            },
        });

        return result?.toJSON() as MetaModel || {
            replyCount: 0,
            repostCount: 0,
            likeCount: 0,
        };
    }

    const addLike = async (messageId: string) => {
        return mutex.runExclusive(async () => {
            const result = await model.findOne({
                where: {
                    messageId,
                },
            });

            if (result) {
                const data = result.toJSON() as MetaModel;
                return result.update({
                    ...data,
                    likeCount: Number(data.likeCount) + 1,
                });
            }

            const res = await model.create({
                messageId,
                likeCount: 1,
                replyCount: 0,
                repostCount: 0,
            });

            return res;
        });
    }

    const addReply = async (messageId: string) => {
        return mutex.runExclusive(async () => {
            const result = await model.findOne({
                where: { messageId },
            });

            if (result) {
                const data = result.toJSON() as MetaModel;
                return result.update({
                    ...data,
                    replyCount: Number(data.replyCount) + 1,
                });
            }

            const res = await model.create({
                messageId,
                likeCount: 0,
                replyCount: 1,
                repostCount: 0,
            });

            return res;
        });
    }

    const addRepost = async (messageId: string) => {
        return mutex.runExclusive(async () => {
            const result = await model.findOne({
                where: {
                    messageId,
                },
            });

            if (result) {
                const data = result.toJSON() as MetaModel;
                return result.update({
                    ...data,
                    repostCount: Number(data.repostCount) + 1,
                });
            }

            const res = await model.create({
                messageId,
                likeCount: 0,
                replyCount: 0,
                repostCount: 1,
            });

            return res;
        });
    }

    return {
        model,
        findOne,
        addLike,
        addReply,
        addRepost,
    };
}

export default meta;