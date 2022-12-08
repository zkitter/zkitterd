import { Sequelize, BIGINT, STRING } from 'sequelize';
import { Mutex } from 'async-mutex';

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
      reader: {
        type: STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      context: {
        type: STRING,
      },
      lastread: {
        type: BIGINT,
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
          reader: record.reader,
          context: record.context,
        },
      });

      if (result) return result.update({ lastread: record.lastread });
      return model.create(record);
    });
  };

  const getLastRead = async (reader: string, context: string) => {
    const result = await model.findOne({
      where: {
        reader,
        context,
      },
    });

    return result?.toJSON();
  };

  return {
    model,
    update,
    getLastRead,
  };
};

export default lastread;
