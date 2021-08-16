import {BIGINT, Sequelize, STRING} from "sequelize";
import userMetaSeq from "./userMeta";
import {Mutex} from "async-mutex";

type UserModel = {
    name: string;
    pubkey: string;
    joined: number;
};

const mutex = new Mutex();

const users = (sequelize: Sequelize, userMeta: ReturnType<typeof userMetaSeq>) => {
    const model = sequelize.define('users', {
        name: {
            type: STRING,
            allowNull: false,
            validate: {
                notEmpty: true,
            },
            primaryKey: true,
            unique: true,
        },
        pubkey: {
            type: STRING,
            allowNull: false,
            validate: {
                notEmpty: true,
            },
        },
        joined: {
            type: BIGINT,
        },
    }, {
        indexes: [
            { fields: ['name'] },
            { fields: ['pubkey'] },
        ]
    });

    const findOneByName = async (name: string): Promise<UserModel|null> => {
        let result = await model.findOne({
            where: {
                name,
            },
            include: [
                {
                    model: userMeta.model,
                    as: 'meta',
                },
            ],
        });

        if (!result) return null;

        const json = result.toJSON() as UserModel;
        // @ts-ignore
        const meta = result.meta && result.meta.toJSON();

        const value: any = {
            ...json,
            meta,
        };

        return value;
    }

    const findOneByPubkey = async (pubkey: string): Promise<UserModel|null> => {
        let result = await model.findOne({
            where: {
                pubkey,
            },
            include: [
                {
                    model: userMeta.model,
                    as: 'meta',
                },
            ],
        });

        if (!result) return null;

        const json = result.toJSON() as UserModel;
        // @ts-ignore
        const meta = result.meta && result.meta.toJSON();

        const value: any = {
            ...json,
            meta,
        };

        return value;
    }

    const readAll = async (offset = 0, limit = 20): Promise<UserModel[]> => {
        let result = await model.findAll({
            offset,
            limit,
            include: [
                {
                    model: userMeta.model,
                    as: 'meta',
                },
            ],
        });

        const values: any[] = [];

        for (const r of result) {
            const json = r.toJSON() as UserModel;
            // @ts-ignore
            const meta = result.meta && result.meta.toJSON();
            values.push({
                ...json,
                meta: {
                    followerCount: meta?.followerCount || 0,
                    followingCount: meta?.followingCount || 0,
                    blockedCount: meta?.blockedCount || 0,
                    blockingCount: meta?.blockingCount || 0,
                }
            });
        }

        return values;
    }

    const updateOrCreateUser = async (user: UserModel) => {
        return mutex.runExclusive(async () => {
            const result = await model.findOne({
                where: {
                    name: user.name,
                }
            });

            if (result) {
                const json = result.toJSON() as UserModel;
                if (user.joined > json.joined) {
                    return result.update(user);
                }
            }

            return model.create(user);
        });
    }

    const ensureUser = async (name: string) => {
        return mutex.runExclusive(async () => {
            const result = await model.findOne({
                where: {
                    name: name,
                }
            });

            if (!result) {
                return model.create({
                    name,
                    pubkey: '',
                    joined: 0,
                });
            }

        });
    }

    return {
        model,
        ensureUser,
        findOneByName,
        findOneByPubkey,
        readAll,
        updateOrCreateUser,
    };
}

export default users;