import { Mutex } from 'async-mutex';
import { Sequelize, STRING } from 'sequelize';
import Web3 from 'web3';

const mutex = new Mutex();

const semaphoreCreators = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'semaphore_creators',
    {
      group: {
        type: STRING,
      },
      message_id: {
        type: STRING,
      },
      provider: {
        type: STRING,
      },
    },
    {
      indexes: [
        { fields: ['provider'] },
        { fields: ['group'] },
        { fields: ['message_id'], unique: true },
      ],
    }
  );

  const addSemaphoreCreator = async (messageId: string, provider: string, group: string) => {
    return mutex.runExclusive(async () => {
      return await model.create({
        group: group,
        message_id: messageId,
        provider: provider,
      });
    });
  };

  const getGroupByMessageId = async (messageId: string) => {
    const data = await model.findOne({
      where: {
        message_id: messageId,
      },
    });

    if (data) {
      const json = data?.toJSON();
      if (json.provider === 'taz') return 'semaphore_taz_members';
      if (json.provider === 'all') return 'zksocial_all';
      if (Web3.utils.isAddress(json.provider)) return 'custom_' + json.provider;
      return `interrep_${json.provider}_${json.group}`;
    }
  };

  return {
    addSemaphoreCreator,
    getGroupByMessageId,
    model,
  };
};

export default semaphoreCreators;
