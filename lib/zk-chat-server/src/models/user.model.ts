import {Mutex} from "async-mutex";
import {BIGINT, ENUM, Op, QueryTypes, Sequelize, STRING} from "sequelize";

const mutex = new Mutex();

const users = (sequelize: Sequelize) => {
    const model = sequelize.define('zkchat_users', {
        wallet_address: {
            type: STRING,
            primaryKey: true,
        },
        pubkey: {
            type: STRING,
            allowNull: false,
        },
    }, {
        indexes: [
            { fields: ['wallet_address'] },
            { fields: ['pubkey'] },
        ],
    });

    const insertUser = async (wallet_address: string, pubkey: string) => {
        return mutex.runExclusive(async () => {
            const res = await model.create({
                wallet_address,
                pubkey,
            });
            return res;
        });
    }

    const getUsers = async (offset = 0, limit = 20) => {
        const res = await model.findAll({
            limit,
            offset,
            order: [
                ['createdAt', 'DESC'],
            ],
        });

        // @ts-ignore
        return res.map(data => data.toJSON());
    }

    const getUserByAddress = async (wallet_address: string) => {
        const res = await model.findOne({
            where: {
                wallet_address,
            },
        });

        return res?.toJSON();
    }

    const getUserByPubkey = async (pubkey: string) => {
        const res = await model.findOne({
            where: {
                pubkey,
            },
        });

        return res?.toJSON();
    }

    return {
        model,
        insertUser,
        getUsers,
        getUserByAddress,
        getUserByPubkey,
    };
}

export default users;