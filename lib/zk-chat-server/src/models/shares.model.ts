import {Mutex} from "async-mutex";
import {BIGINT, ENUM, Op, QueryTypes, Sequelize, STRING} from "sequelize";

const mutex = new Mutex();

export type ShareModel = {
    x_share: string;
    y_share: string;
    nullifier: string;
    epoch: string;
}

const shares = (sequelize: Sequelize) => {
    const model = sequelize.define('zkchat_shares', {
        x_share: {
            type: STRING,
        },
        y_share: {
            type: STRING,
        },
        nullifier: {
            type: STRING,
        },
        epoch: {
            type: STRING,
        },
    }, {
        indexes: [
            { fields: ['x_share', 'y_share', 'nullifier', 'epoch'], unique: true },
            { fields: ['nullifier'] },
            { fields: ['epoch'] },
        ],
    });

    const checkShare = async (data: ShareModel) => {
        const shares = await getShares(data.nullifier, data.epoch);
        const duplicate = await model.findOne({ where: data });
        return {
            shares,
            isDuplicate: !!duplicate,
            isSpam: !!shares.length,
        };
    };

    const insertShare = async (data: ShareModel) => {
        return mutex.runExclusive(async () => {
            const res = await model.create(data);
            return res;
        });
    };

    const getShares = async (nullifier: string, epoch: string): Promise<ShareModel[]> => {
        const res = await model.findAll({
            where: {
                nullifier,
                epoch,
            },
        });

        // @ts-expect-error
        return res.map(data => data.toJSON());
    };

    return {
        model,
        checkShare,
        insertShare,
        getShares,
    }
};

export default shares;