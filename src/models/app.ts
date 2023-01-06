import { Mutex } from 'async-mutex';
import { BIGINT, Sequelize } from 'sequelize';

const mutex = new Mutex();

type AppModel = {
  lastENSBlockScanned: number;
  lastInterrepBlockScanned: number;
  lastArbitrumBlockScanned: number;
  lastGroup42BlockScanned: number;
};

const app = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'app',
    {
      lastArbitrumBlockScanned: {
        type: BIGINT,
      },
      lastENSBlockScanned: {
        type: BIGINT,
      },
      lastGroup42BlockScanned: {
        type: BIGINT,
      },
      lastInterrepBlockScanned: {
        type: BIGINT,
      },
    },
    {}
  );

  const read = async (): Promise<AppModel> => {
    return mutex.runExclusive(async () => {
      const result = await model.findOne();
      return result?.toJSON() as AppModel;
    });
  };

  const updateLastENSBlock = async (blockHeight: number) => {
    return mutex.runExclusive(async () => {
      const result = await model.findOne();

      if (result) {
        return result.update({
          lastENSBlockScanned: blockHeight,
        });
      }

      return model.create({
        lastENSBlockScanned: blockHeight,
      });
    });
  };

  const updateLastInterrepBlock = async (blockHeight: number) => {
    return mutex.runExclusive(async () => {
      const result = await model.findOne();

      if (result) {
        return result.update({
          lastInterrepBlockScanned: blockHeight,
        });
      }

      return model.create({
        lastInterrepBlockScanned: blockHeight,
      });
    });
  };

  const updateLastArbitrumBlock = async (blockHeight: number) => {
    return mutex.runExclusive(async () => {
      const result = await model.findOne();

      if (result) {
        return result.update({
          lastArbitrumBlockScanned: blockHeight,
        });
      }

      return model.create({
        lastArbitrumBlockScanned: blockHeight,
      });
    });
  };

  const updateLastGroup42BlockScanned = async (blockHeight: number) => {
    return mutex.runExclusive(async () => {
      const result = await model.findOne();

      if (result) {
        return result.update({
          lastGroup42BlockScanned: blockHeight,
        });
      }

      return model.create({
        lastGroup42BlockScanned: blockHeight,
      });
    });
  };

  return {
    model,
    read,
    updateLastArbitrumBlock,
    updateLastENSBlock,
    updateLastGroup42BlockScanned,
    updateLastInterrepBlock,
  };
};

export default app;
