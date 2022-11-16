import { Sequelize, STRING } from 'sequelize';
import { Mutex } from 'async-mutex';

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
        type: STRING,
        allowNull: false,
      },
      provider: {
        type: STRING,
        allowNull: false,
      },
      root_hash: {
        type: STRING,
        allowNull: false,
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
          provider,
          name,
        },
      });

      if (!result) {
        return model.create({
          root_hash,
          provider,
          name,
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
          provider,
          name,
        },
      });

      return result?.toJSON() as InterepGroupModel;
    });
  };

  return {
    model,
    findOneByHash,
    addHash,
    getGroup,
  };
};

export default interepGroups;
