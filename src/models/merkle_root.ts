import { Sequelize, STRING } from 'sequelize';

type MerkleRootModel = {
  root_hash: string;
  group_id: string;
};

const merkleRoot = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'merkle_root',
    {
      group_id: {
        type: STRING,
      },
      root_hash: {
        type: STRING,
      },
    },
    {
      indexes: [{ fields: ['root_hash'], unique: true }, { fields: ['group_id'] }],
    }
  );

  const getGroupByRoot = async (root_hash: string): Promise<MerkleRootModel> => {
    const result = await model.findOne({
      where: {
        root_hash,
      },
    });

    return result?.toJSON() as MerkleRootModel;
  };

  const addRoot = async (root_hash: string, group_id: string) => {
    const exist = await model.findOne({
      where: {
        root_hash,
      },
    });

    if (!exist) {
      return model.create({
        group_id,
        root_hash,
      });
    }
  };

  return {
    addRoot,
    getGroupByRoot,
    model,
  };
};

export default merkleRoot;
