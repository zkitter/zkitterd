import { Mutex } from 'async-mutex';
import { BIGINT, Sequelize, STRING } from 'sequelize';

const mutex = new Mutex();

type LastReadModel = {
  reader: string;
  context: string;
  lastread: number;
};

const lastread = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'lastread',
    {
      context: {
        type: STRING,
      },
      lastread: {
        type: BIGINT,
        validate: {
          notEmpty: true,
        },
      },
      reader: {
        allowNull: false,
        type: STRING,
        validate: {
          notEmpty: true,
        },
      },
    },
    {
      indexes: [{ fields: ['reader'] }, { fields: ['context'] }],
    }
  );

  const update = async (record: LastReadModel) => {
    return mutex.runExclusive(async () => {
      const result = await model.findOne({
        where: {
          context: record.context,
          reader: record.reader,
        },
      });

      if (result) return result.update({ lastread: record.lastread });
      return model.create(record);
    });
  };

  const getLastRead = async (reader: string, context: string) => {
    const result = await model.findOne({
      where: {
        context,
        reader,
      },
    });

    return result?.toJSON();
  };

  return {
    getLastRead,
    model,
    update,
  };
};

export default lastread;
