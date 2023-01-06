import { Mutex } from 'async-mutex';
import { Sequelize, STRING } from 'sequelize';

const mutex = new Mutex();

const threads = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'threads',
    {
      message_id: {
        type: STRING,
      },
      root_id: {
        type: STRING,
      },
    },
    {
      indexes: [{ fields: ['root_id', 'message_id'], unique: true }],
    }
  );

  const addThreadData = async (rootId: string, messageId: string) => {
    return mutex.runExclusive(async () => {
      return await model.create({
        message_id: messageId,
        root_id: rootId,
      });
    });
  };

  const removeThreadData = async (rootId: string, messageId: string) => {
    return mutex.runExclusive(async () => {
      try {
        return await model.destroy({
          where: {
            message_id: messageId,
            root_id: rootId,
          },
        });
      } catch (e) {
        return false;
      }
    });
  };

  return {
    addThreadData,
    model,
    removeThreadData,
  };
};

export default threads;
