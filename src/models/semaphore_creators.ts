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

  return {
    addSemaphoreCreator,
    model,
  };
};

export default semaphoreCreators;

export function covertToGroupId(provider: string, group: string): string {
  if (provider === 'taz') return 'semaphore_taz_members';
  if (provider === 'all') return 'zksocial_all';
  if (Web3.utils.isAddress(provider)) return 'custom_' + provider;
  if (['twitter', 'reddit', 'github'].includes(provider)) {
    return `interrep_${provider}_${group}`;
  }
  return '';
}
