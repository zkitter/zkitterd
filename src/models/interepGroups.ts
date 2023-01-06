import { Mutex } from 'async-mutex';
import { Sequelize, STRING } from 'sequelize';

type InterepGroupModel = {
  provider: string;
  name: string;
  root_hash: string;
};

const mutex = new Mutex();

const interepGroups = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'interep_groups',
    {
      name: {
        allowNull: false,
        type: STRING,
      },
      provider: {
        allowNull: false,
        type: STRING,
      },
      root_hash: {
        allowNull: false,
        type: STRING,
      },
    },
    {
      indexes: [
        { fields: ['root_hash'] },
        { fields: ['provider'] },
        { fields: ['name'] },
        { fields: ['provider', 'name'], unique: true },
      ],
    }
  );

  const findOneByHash = async (root_hash: string): Promise<InterepGroupModel | null> => {
    const result = await model.findOne({
      where: {
        root_hash,
      },
    });

    return result?.toJSON() as InterepGroupModel;
  };

  const addHash = async (root_hash: string, provider: string, name: string) => {
    return mutex.runExclusive(async () => {
      const result = await model.findOne({
        where: {
          name,
          provider,
        },
      });

      if (!result) {
        return model.create({
          name,
          provider,
          root_hash,
        });
      } else {
        return result.update({
          root_hash,
        });
      }
    });
  };

  const getGroup = async (provider: string, name: string): Promise<InterepGroupModel> => {
    return mutex.runExclusive(async () => {
      const result = await model.findOne({
        where: {
          name,
          provider,
        },
      });

      return result?.toJSON() as InterepGroupModel;
    });
  };

  return {
    addHash,
    findOneByHash,
    getGroup,
    model,
  };
};

export default interepGroups;
