import {BIGINT, Sequelize, STRING} from "sequelize";
import {Mutex} from "async-mutex";

type MetaModel = {
    hash: string;
    replyCount: number;
    likeCount: number;
    repostCount: number;
};

const mutex = new Mutex();

const meta = (sequelize: Sequelize) => {
    const model = sequelize.define('meta', {
        hash: {
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
            { fields: ['hash'], unique: true }
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

    const addLike = async (hash: string) => {
        return mutex.runExclusive(async () => {
            const result = await model.findOne({
                where: { hash },
            });

            if (result) {
                const data = result.toJSON() as MetaModel;
                return result.update({
                    ...data,
                    likeCount: data.likeCount + 1,
                });
            }

            const res = await model.create({
                hash,
                likeCount: 1,
                replyCount: 0,
                repostCount: 0,
            });

            return res;
        });
    }

    const addReply = async (hash: string) => {
        return mutex.runExclusive(async () => {

            const result = await model.findOne({
                where: { hash },
            });

            if (result) {
                const data = result.toJSON() as MetaModel;
                return result.update({
                    ...data,
                    replyCount: data.replyCount + 1,
                });
            }

            const res = await model.create({
                hash,
                likeCount: 0,
                replyCount: 1,
                repostCount: 0,
            });

            return res;
        });
    }

    const addRepost = async (hash: string) => {
        return mutex.runExclusive(async () => {

            const result = await model.findOne({
                where: { hash },
            });

            if (result) {
                const data = result.toJSON() as MetaModel;
                return result.update({
                    ...data,
                    repostCount: data.repostCount + 1,
                });
            }

            const res = await model.create({
                hash,
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