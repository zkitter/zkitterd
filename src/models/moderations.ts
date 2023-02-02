import { BIGINT, QueryTypes, Sequelize, STRING } from 'sequelize';

import { ModerationJSON, PostJSON } from '@util/message';

type ModerationModel = {
  messageId: string;
  hash: string;
  creator: string;
  type: string;
  subtype: string;
  createdAt: number;
  reference: string;
};

const moderations = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'moderations',
    {
      createdAt: {
        allowNull: false,
        type: BIGINT,
      },
      creator: {
        allowNull: false,
        type: STRING,
      },
      hash: {
        allowNull: false,
        primaryKey: true,
        type: STRING,
      },
      messageId: {
        allowNull: false,
        type: STRING,
      },
      reference: {
        type: STRING,
      },
      subtype: {
        type: STRING,
      },
      type: {
        allowNull: false,
        type: STRING,
      },
    },
    {
      indexes: [
        { fields: ['creator'] },
        { fields: ['subtype'] },
        { fields: ['hash'], unique: true },
        { fields: ['messageId'], unique: true },
      ],
    }
  );

  const getAll = async (): Promise<ModerationModel[]> => {
    const list = await model.findAll<any>();
    return list.map(data => data.toJSON());
  };

  const findOne = async (hash: string): Promise<ModerationModel | null> => {
    const result: any = await model.findOne({
      where: {
        hash,
      },
    });

    if (!result) return null;

    const json = result.toJSON() as ModerationModel;

    return json;
  };

  const remove = async (hash: string) => {
    return model.destroy({
      where: {
        hash,
      },
    });
  };

  const findThreadModeration = async (message_id: string) => {
    const result = await sequelize.query(
      `
            SELECT 
                m."messageId",
                m.creator,
                m.reference,
                m.type,
                m.subtype,
                m.hash,
                m."createdAt",
                m."updatedAt"
            FROM threads t
            JOIN posts p ON p."messageId" = t.root_id
            JOIN moderations m ON m.reference = t.message_id AND m.creator = p.creator AND m.subtype IN ('THREAD_HIDE_BLOCK', 'THREAD_ONLY_MENTION', 'THREAD_SHOW_FOLLOW')
            WHERE t.message_id = :message_id
        `,
      {
        replacements: {
          message_id,
        },
        type: QueryTypes.SELECT,
      }
    );

    if (result) {
      return result;
    }

    return null;
  };

  const findAllByReference = async (
    reference: string,
    offset = 0,
    limit = 20,
    order: 'DESC' | 'ASC' = 'DESC'
  ): Promise<ModerationJSON[]> => {
    const result = await model.findAll({
      limit,
      offset,
      order: [['createdAt', order]],
      where: {
        reference,
      },
    });

    return result.map((r: any) => r.toJSON() as ModerationJSON);
  };

  const findAllLikesByReference = async (
    reference: string,
    offset = 0,
    limit = 20,
    order: 'DESC' | 'ASC' = 'DESC'
  ): Promise<string[]> => {
    const result = await model.findAll({
      attributes: ['creator'],
      limit,
      offset,
      order: [['createdAt', order]],
      where: { reference, subtype: 'LIKE' },
    });

    return result.map((r: any) => r.toJSON().creator);
  };

  const createModeration = async (record: ModerationModel) => {
    return model.create(record);
  };

  return {
    createModeration,
    findAllByReference,
    findAllLikesByReference,
    findOne,
    findThreadModeration,
    model,
    remove,
    getAll,
  };
};

export default moderations;
