import {BIGINT, Sequelize, STRING} from "sequelize";
import {Mutex} from "async-mutex";

type UserMetaModel = {
    name: string;
    followerCount: number;
    followingCount: number;
    blockedCount: number;
    blockingCount: number;
};

const mutex = new Mutex();

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
            followerCount: 0,
            followingCount: 0,
            blockedCount: 0,
            blockingCount: 0,
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
                followerCount: 1,
                followingCount: 0,
                blockedCount: 0,
                blockingCount: 0,
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
                followerCount: 0,
                followingCount: 1,
                blockedCount: 0,
                blockingCount: 0,
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
                followerCount: 0,
                followingCount: 0,
                blockedCount: 1,
                blockingCount: 0,
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
                followerCount: 0,
                followingCount: 0,
                blockedCount: 0,
                blockingCount: 1,
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
    };
}

export default userMeta;