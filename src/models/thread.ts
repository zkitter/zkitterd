import { Sequelize, STRING } from 'sequelize';
import { Mutex } from 'async-mutex';

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
        root_id: rootId,
        message_id: messageId,
      });
    });
  };

  const removeThreadData = async (rootId: string, messageId: string) => {
    return mutex.runExclusive(async () => {
      try {
        return await model.destroy({
          where: {
            root_id: rootId,
            message_id: messageId,
          },
        });
      } catch (e) {
        return false;
      }
    });
  };

  return {
    model,
    addThreadData,
    removeThreadData,
  };
};

export default threads;
