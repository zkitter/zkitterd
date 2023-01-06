import { Mutex } from 'async-mutex';
import { BIGINT, ENUM, Op, QueryTypes, Sequelize, STRING } from 'sequelize';

const mutex = new Mutex();

export type ChatMessageModel = {
  message_id: string;
  type: 'DIRECT' | 'PUBLIC_ROOM' | 'PRIVATE_ROOM';
  sender_address?: string;
  sender_pubkey?: string;
  sender_hash?: string;
  timestamp: number;
  rln_serialized_proof?: string;
  rln_root?: string;
  receiver_address?: string;
  receiver_pubkey?: string;
  ciphertext?: string;
  content?: string;
  reference?: string;
  attachment?: string;
};

export type Chat =
  | {
      type: 'DIRECT';
      receiver: string;
      receiverECDH: string;
      senderECDH: string;
      senderHash?: string;
    }
  | {
      type: 'PUBLIC_ROOM';
      receiver: string;
    };

const REALLY_BIG_NUMBER = 999999999999999999;

const chats = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'zkchat_chats',
    {
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
      sender_hash: {
        type: STRING,
      },
      timestamp: {
        type: BIGINT,
        allowNull: false,
      },
      rln_serialized_proof: {
        type: STRING(65535),
      },
      rln_root: {
        type: STRING,
      },
      receiver_address: {
        type: STRING,
      },
      receiver_pubkey: {
        type: STRING,
      },
      ciphertext: {
        type: STRING(65535),
      },
      content: {
        type: STRING(65535),
      },
      reference: {
        type: STRING,
      },
      attachment: {
        type: STRING,
      },
    },
    {
      indexes: [
        { fields: ['message_id'] },
        { fields: ['receiver_address'] },
        { fields: ['receiver_pubkey'] },
        { fields: ['sender_address'] },
        { fields: ['sender_pubkey'] },
        { fields: ['rln_root'] },
      ],
    }
  );

  const insertChatMessage = async (data: ChatMessageModel) => {
    return mutex.runExclusive(async () => {
      const res = await model.create(data);
      return res;
    });
  };

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
  };

  const getUnreadCountDM = async (
    sender_pubkey: string,
    receiver_pubkey: string,
    lastRead = 0
  ): Promise<ChatMessageModel[]> => {
    const values = await sequelize.query(
      `
            SELECT COUNT(*) FROM zkchat_chats zk
            WHERE zk.sender_pubkey = :sender_pubkey
            AND zk.receiver_pubkey = :receiver_pubkey
            AND zk.timestamp > :lastRead
        `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          sender_pubkey,
          receiver_pubkey,
          lastRead,
        },
      }
    );

    // @ts-expect-error
    return Number(values[0]?.count || 0);
  };

  const getDirectMessages = async (
    sender_pubkey: string,
    receiver_pubkey: string,
    offset = REALLY_BIG_NUMBER,
    limit = 20
  ): Promise<ChatMessageModel[]> => {
    const values = await sequelize.query(
      `
            SELECT * FROM zkchat_chats zk
            WHERE (
                (zk.sender_pubkey = :sender_pubkey AND zk.receiver_pubkey = :receiver_pubkey)
                OR
                (zk.sender_pubkey = :receiver_pubkey AND zk.receiver_pubkey = :sender_pubkey)
            ) AND (
                zk.timestamp < :offset
            )
            ORDER BY zk.timestamp DESC
            LIMIT :limit
        `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          sender_pubkey,
          receiver_pubkey,
          limit,
          offset,
        },
      }
    );

    // @ts-expect-error
    return values;
  };

  const getDirectChatsForUser = async (pubkey: string): Promise<Chat[]> => {
    const values = await sequelize.query(
      `
            SELECT distinct zkc.receiver_pubkey as pubkey, zkc.receiver_address as address FROM zkchat_chats zkc
            WHERE zkc.receiver_pubkey IN (
                SELECT distinct receiver_pubkey FROM zkchat_chats WHERE sender_pubkey = :pubkey
            )
            UNION
            SELECT distinct zkc.sender_pubkey as pubkey, zkc.sender_address as address FROM zkchat_chats zkc
            WHERE zkc.sender_pubkey IN (
                SELECT distinct sender_pubkey FROM zkchat_chats WHERE receiver_pubkey = :pubkey
            );
        `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          pubkey,
        },
      }
    );

    return values.map((data: any) => ({
      type: 'DIRECT',
      receiver: data.address,
      receiverECDH: data.pubkey,
      senderECDH: pubkey,
    }));
  };

  const getMessagesByRoomId = async (
    roomId: string,
    offset = 0,
    limit = 20
  ): Promise<ChatMessageModel[]> => {
    const res = await model.findAll({
      where: {
        receiver: roomId,
      },
      limit,
      offset,
      order: [['timestamp', 'DESC']],
    });

    // @ts-expect-error
    return res.map(data => data.toJSON());
  };

  return {
    model,
    insertChatMessage,
    removeChatMessage,
    getDirectMessages,
    getUnreadCountDM,
    getMessagesByRoomId,
    getDirectChatsForUser,
  };
};

export default chats;
