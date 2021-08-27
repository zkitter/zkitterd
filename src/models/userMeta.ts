import {BIGINT, Sequelize, STRING} from "sequelize";
import {Mutex} from "async-mutex";

type UserMetaModel = {
    name: string;
    followerCount: number;
    followingCount: number;
    blockedCount: number;
    blockingCount: number;
    mentionedCount: number;
    postingCount: number;
};

const mutex = new Mutex();

const emptyMeta = {
    followerCount: 0,
    followingCount: 0,
    blockedCount: 0,
    blockingCount: 0,
    mentionedCount: 0,
    postingCount: 0,
};

const userMeta = (sequelize: Sequelize) => {
    const model = sequelize.define('usermeta', {
        name: {
            type: STRING,
            allowNull: false,
            primaryKey: true,
        },
        followerCount: {
            type: BIGINT,
        },
        followingCount: {
            type: BIGINT,
        },
        blockedCount: {
            type: BIGINT,
        },
        blockingCount: {
            type: BIGINT,
        },
        mentionedCount: {
            type: BIGINT,
        },
        postingCount: {
            type: BIGINT,
        },
    }, {
        indexes: [
            { fields: ['name'], unique: true }
        ],
    });

    const findOne = async (name: string): Promise<UserMetaModel|null> => {
        let result = await model.findOne({
            where: {
                name,
            },
        });

        return result?.toJSON() as UserMetaModel || {
            ...emptyMeta,
        };
    }

    const addFollower = async (name: string) => {
        return mutex.runExclusive(async () => {
            const result = await model.findOne({
                where: { name },
            });

            if (result) {
                const data = result.toJSON() as UserMetaModel;
                return result.update({
                    ...data,
                    followerCount: Number(data.followerCount) + 1,
                });
            }

            const res = await model.create({
                name,
                ...emptyMeta,
                followerCount: 1,
            });

            return res;
        });
    }

    const addFollowing = async (name: string) => {
        return mutex.runExclusive(async () => {

            const result = await model.findOne({
                where: { name },
            });

            if (result) {
                const data = result.toJSON() as UserMetaModel;
                return result.update({
                    ...data,
                    followingCount: Number(data.followingCount) + 1,
                });
            }

            const res = await model.create({
                name,
                ...emptyMeta,
                followingCount: 1,
            });

            return res;
        });
    }

    const addBlocked = async (name: string) => {
        return mutex.runExclusive(async () => {

            const result = await model.findOne({
                where: { name },
            });

            if (result) {
                const data = result.toJSON() as UserMetaModel;
                return result.update({
                    ...data,
                    blockedCount: Number(data.blockedCount) + 1,
                });
            }

            const res = await model.create({
                name,
                ...emptyMeta,
                blockedCount: 1,
            });

            return res;
        });
    }

    const addBlocking = async (name: string) => {
        return mutex.runExclusive(async () => {

            const result = await model.findOne({
                where: { name },
            });

            if (result) {
                const data = result.toJSON() as UserMetaModel;
                return result.update({
                    ...data,
                    blockingCount: Number(data.blockingCount) + 1,
                });
            }

            const res = await model.create({
                name,
                ...emptyMeta,
                blockingCount: 1,
            });

            return res;
        });
    }

    const addPostingCount = async (name: string) => {
        return mutex.runExclusive(async () => {

            const result = await model.findOne({
                where: { name },
            });

            if (result) {
                const data = result.toJSON() as UserMetaModel;
                return result.update({
                    ...data,
                    postingCount: Number(data.postingCount) + 1,
                });
            }

            const res = await model.create({
                name,
                ...emptyMeta,
                postingCount: 1,
            });

            return res;
        });
    }

    const addMentionedCount = async (name: string) => {
        return mutex.runExclusive(async () => {

            const result = await model.findOne({
                where: { name },
            });

            if (result) {
                const data = result.toJSON() as UserMetaModel;
                return result.update({
                    ...data,
                    mentionedCount: Number(data.mentionedCount) + 1,
                });
            }

            const res = await model.create({
                name,
                ...emptyMeta,
                mentionedCount: 1,
            });

            return res;
        });
    }

    return {
        model,
        findOne,
        addFollower,
        addFollowing,
        addBlocked,
        addBlocking,
        addPostingCount,
        addMentionedCount,
    };
}

export default userMeta;