import {Mutex} from "async-mutex";
import {BIGINT, ENUM, QueryTypes, Sequelize, STRING} from "sequelize";

const mutex = new Mutex();

const chats = (sequelize: Sequelize) => {
    const model = sequelize.define('uploads', {
        message_id: {
          type: STRING,
          primaryKey: true,
        },
        type: {
            type: STRING,
            allowNull: false,
        },
        sender_pubkey: {
            type: STRING,
        },
        sender_ekey: {
            type: STRING,
        },
        rln_serialized_proof: {
            type: STRING,
        },
        rln_root: {
            type: STRING,
        },
        receiver: {
            type: STRING,
        },
        data: {
            type: STRING,
        },
        content: {
            type: STRING,
        },
        reference: {
            type: STRING,
        },
        attachment: {
            type: STRING,
        },
    }, {
        indexes: [
            { fields: ['cid'] },
            { fields: ['filename'] },
            { fields: ['username'] },
            { fields: ['mimetype'] },
        ],
    });

    const addUploadData = async (data: UploadModel) => {
        return mutex.runExclusive(async () => {
            const res = await model.create(data);
            return res;
        });
    }

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
    }

    const getTotalUploadByUser = async (username: string) => {
        const res = await model.sum('size', {
            where: {
                username,
            },
        });

        if (isNaN(res)) return 0;

        return res;
    }

    return {
        model,
        addUploadData,
        removeUploadData,
        getTotalUploadByUser,
    };
}

export default chats;