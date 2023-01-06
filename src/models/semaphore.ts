import { Mutex } from 'async-mutex';
import { Sequelize, STRING } from 'sequelize';

type SemaphoreModel = {
  id_commitment: string;
  group_id: string;
  root_hash: string;
};

const mutex = new Mutex();

const semaphore = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'semaphore',
    {
      group_id: {
        allowNull: false,
        type: STRING,
      },
      id_commitment: {
        allowNull: false,
        type: STRING,
      },
      root_hash: {
        allowNull: false,
        type: STRING,
      },
    },
    {
      indexes: [{ fields: ['id_commitment'] }, { fields: ['group_id'] }, { fields: ['root_hash'] }],
    }
  );

  const findOneByCommitment = async (id_commitment: string): Promise<SemaphoreModel | null> => {
    const result = await model.findOne({
      order: [['createdAt', 'DESC']],
      where: {
        id_commitment,
      },
    });

    return result?.toJSON() as SemaphoreModel;
  };

  const findOne = async (
    id_commitment: string,
    group_id: string
  ): Promise<SemaphoreModel | null> => {
    const result = await model.findOne({
      order: [['createdAt', 'DESC']],
      where: {
        group_id,
        id_commitment,
      },
    });

    return result?.toJSON() as SemaphoreModel;
  };

  const findAllByCommitment = async (id_commitment: string): Promise<SemaphoreModel[]> => {
    const result = await model.findAll({
      where: {
        id_commitment,
      },
    });

    return result.map(r => r.toJSON()) as SemaphoreModel[];
  };

  const findAllByGroup = async (group: string): Promise<SemaphoreModel[]> => {
    const result = await model.findAll({
      where: {
        group,
      },
    });

    return result.map(r => r.toJSON()) as SemaphoreModel[];
  };

  const addID = async (id_commitment: string, group_id: string, root_hash: string) => {
    return mutex.runExclusive(async () => {
      const result = await model.findOne({
        where: {
          group_id,
          id_commitment,
        },
      });

      if (!result) {
        return model.create({
          group_id,
          id_commitment,
          root_hash,
        });
      } else {
        return result.update({ root_hash });
      }
    });
  };

  const removeID = async (id_commitment: string, group_id: string, root_hash: string) => {
    return mutex.runExclusive(async () => {
      return model.destroy({
        where: {
          group_id,
          id_commitment,
          root_hash,
        },
      });
    });
  };

  return {
    addID,
    findAllByCommitment,
    findAllByGroup,
    findOne,
    findOneByCommitment,
    model,
    removeID,
  };
};

export default semaphore;
