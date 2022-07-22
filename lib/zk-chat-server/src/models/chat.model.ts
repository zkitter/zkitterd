import {Mutex} from "async-mutex";
import {BIGINT, ENUM, Op, QueryTypes, Sequelize, STRING} from "sequelize";

const mutex = new Mutex();

export type ChatMessageModel = {
    message_id: string;
    type: 'DIRECT' | 'PUBLIC_ROOM' | 'PRIVATE_ROOM';
    sender_address?: string;
    sender_pubkey?: string;
    timestamp: number;
    rln_serialized_proof?: string;
    rln_root?: string;
    receiver_address: string;
    ciphertext?: string;
    content?: string;
    reference?: string;
    attachment?: string;
}

const chats = (sequelize: Sequelize) => {
    const model = sequelize.define('zkchat_chats', {
        message_id: {
          type: STRING,
          primaryKey: true,
        },
        type: {
            type: STRING,
            allowNull: false,
        },
        sender_address: {
            type: STRING,
        },
        sender_pubkey: {
            type: STRING,
        },
        timestamp: {
            type: BIGINT,
            allowNull: false,
        },
        rln_serialized_proof: {
            type: STRING,
        },
        rln_root: {
            type: STRING,
        },
        receiver_address: {
            type: STRING,
            allowNull: false,
        },
        ciphertext: {
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
            { fields: ['message_id'] },
            { fields: ['receiver_address'] },
            { fields: ['sender_address'] },
            { fields: ['sender_pubkey'] },
            { fields: ['rln_root'] },
        ],
    });

    const insertChatMessage = async (data: ChatMessageModel) => {
        return mutex.runExclusive(async () => {
            const res = await model.create(data);
            return res;
        });
    }

    const removeChatMessage = async (message_id: string) => {
        return mutex.runExclusive(async () => {
            try {
                const res = await model.destroy({
                    where: {
                        message_id,
                    },
                });
                return res;
            } catch (e) {
                return false;
            }
        });
    }

    const getDirectMessages = async (sender_address: string, receiver_address: string, offset = 0, limit = 20): Promise<ChatMessageModel[]> => {
        const values = await sequelize.query(`
            SELECT * FROM zkchat_chats zk
            WHERE (
                (zk.sender_address = :sender_address AND zk.receiver_address = :receiver_address)
                OR
                (zk.sender_address = :receiver_address AND zk.receiver_address = :sender_address)
            )
            ORDER BY zk.timestamp DESC
            LIMIT 20 OFFSET 0
        `, {
            type: QueryTypes.SELECT,
            replacements: {
                sender_address,
                receiver_address,
                limit,
                offset,
            },
        });

        // @ts-ignore
        return values;
    }

    const getMessagesByRoomId = async (roomId: string, offset = 0, limit = 20): Promise<ChatMessageModel[]> => {
        const res = await model.findAll({
            where: {
                receiver: roomId,
            },
            limit,
            offset,
            order: [
                ['timestamp', 'DESC'],
            ],
        });

        // @ts-ignore
        return res.map(data => data.toJSON());
    }

    return {
        model,
        insertChatMessage,
        removeChatMessage,
        getDirectMessages,
        getMessagesByRoomId,
    };
}

export default chats;