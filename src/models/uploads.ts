import { Mutex } from 'async-mutex';
import { BIGINT, ENUM, QueryTypes, Sequelize, STRING } from 'sequelize';

export type UploadModel = {
    cid: string;
    filename: string;
    username: string;
    size: number;
    mimetype: string;
};

const mutex = new Mutex();

const uploads = (sequelize: Sequelize) => {
    const model = sequelize.define(
        'uploads',
        {
            cid: {
                type: STRING,
            },
            filename: {
                type: STRING,
            },
            username: {
                type: STRING,
            },
            size: {
                type: BIGINT,
            },
            mimetype: {
                type: STRING,
            },
        },
        {
            indexes: [
                { fields: ['cid'] },
                { fields: ['filename'] },
                { fields: ['username'] },
                { fields: ['mimetype'] },
            ],
        }
    );

    const addUploadData = async (data: UploadModel) => {
        return mutex.runExclusive(async () => {
            const res = await model.create(data);
            return res;
        });
    };

    const removeUploadData = async (cid: string, filename: string) => {
        return mutex.runExclusive(async () => {
            try {
                const res = await model.destroy({
                    where: {
                        cid,
                        filename,
                    },
                });
                return res;
            } catch (e) {
                return false;
            }
        });
    };

    const getTotalUploadByUser = async (username: string) => {
        const res = await model.sum('size', {
            where: {
                username,
            },
        });

        if (isNaN(res)) return 0;

        return res;
    };

    return {
        model,
        addUploadData,
        removeUploadData,
        getTotalUploadByUser,
    };
};

export default uploads;
