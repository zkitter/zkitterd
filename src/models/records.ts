import { BIGINT, Sequelize, STRING } from 'sequelize';

type RecordModel = {
  soul: string;
  field: string;
  value: string;
  relation: string;
  state: number;
};

const records = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'records',
    {
      field: {
        type: STRING(4095),
      },
      relation: {
        type: STRING(65535),
      },
      soul: {
        type: STRING(4095),
      },
      state: {
        type: BIGINT,
      },
      value: {
        type: STRING(65535),
      },
    },
    {
      indexes: [
        {
          fields: ['soul'],
        },
        {
          fields: ['soul', 'field'],
          unique: true,
        },
      ],
    }
  );

  const findOne = async (soul: string, field: string): Promise<RecordModel | null> => {
    const result = await model.findOne({
      where: {
        field,
        soul,
      },
    });

    return (result?.toJSON() as RecordModel) || null;
  };

  const findAll = async (soul: string): Promise<RecordModel[]> => {
    const result = await model.findAll({
      where: {
        soul,
      },
    });

    return result.map(r => r.toJSON() as RecordModel);
  };

  const readAll = async (offset = 0, limit = 20): Promise<RecordModel[]> => {
    const result = await model.findAll({
      limit,
      offset,
    });

    return result.map(r => r.toJSON() as RecordModel);
  };

  const updateOrCreateRecord = async (record: RecordModel) => {
    const result = await model.findOne({
      where: {
        field: record.field,
        soul: record.soul,
      },
    });

    const json = result?.toJSON() as RecordModel;

    if (json?.state >= record.state) {
      return Promise.resolve();
    }

    if (result) {
      return result.update(record);
    }

    return model.create(record);
  };

  return {
    findAll,
    findOne,
    model,
    readAll,
    updateOrCreateRecord,
  };
};

export default records;
