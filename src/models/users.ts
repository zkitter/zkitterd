import {BIGINT, Sequelize, STRING} from "sequelize";

type UserModel = {
    name: string;
    pubkey: string;
    joined: number;
};

const users = (sequelize: Sequelize) => {
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
            }
        });

        return result?.toJSON() as UserModel || null;
    }

    const findOneByPubkey = async (pubkey: string): Promise<UserModel|null> => {
        let result = await model.findOne({
            where: {
                pubkey,
            }
        });

        return result?.toJSON() as UserModel || null;
    }

    const readAll = async (offset = 0, limit = 20): Promise<UserModel[]> => {
        let result = await model.findAll({
            offset,
            limit,
        });

        return result.map(r => r.toJSON() as UserModel);
    }

    const updateOrCreateUser = async (user: UserModel) => {
        const result = await model.findOne({
            where: {
                name: user.name,
            }
        });

        if (result) {
            return result.update(user);
        }

        return model.create(user);
    }

    return {
        model,
        findOneByName,
        findOneByPubkey,
        readAll,
        updateOrCreateUser,
    };
}

export default users;