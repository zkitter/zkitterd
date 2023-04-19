import { BIGINT, Sequelize, STRING } from 'sequelize';

type MessageModel = {
  type: string;
  creator: string;
  hash: string;
  proof: string;
};

const messages = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'messages',
    {
      type: {
        type: STRING,
      },
      creator: {
        allowNull: false,
        type: STRING,
      },
      hash: {
        allowNull: false,
        primaryKey: true,
        type: STRING,
      },
      proof: {
        type: STRING(65535),
      },
    },
    {
      indexes: [
        {
          fields: ['creator'],
        },
        {
          fields: ['hash'],
          unique: true,
        },
      ],
    }
  );

  const findOne = async (hash: string): Promise<MessageModel | null> => {
    const result = await model.findOne({
      where: {
        hash,
      },
    });

    return (result?.toJSON() as MessageModel) || null;
  };

  const findAllByCreator = async (creator: string): Promise<MessageModel[]> => {
    const result = await model.findAll({
      where: {
        creator,
      },
    });

    return result.map(r => r.toJSON() as MessageModel);
  };

  const updateMessage = async (hash: string, creator: string, type: string) => {
    const result = await model.findOne({
      where: {
        hash,
      },
    });

    if (!result) {
      return model.create({ hash, creator, type });
    } else {
      return result.update({ creator, type });
    }
  };

  const updateProof = async (hash: string, proof: string) => {
    const result = await model.findOne({
      where: { hash },
    });

    if (!result) {
      return model.create({ hash, proof });
    } else {
      return result.update({ proof });
    }
  };

  const remove = async (hash: string) => {
    const result = await model.findOne({
      where: { hash },
    });

    if (result) await result.destroy();
  };

  return {
    findAllByCreator,
    findOne,
    updateMessage,
    updateProof,
    remove,
    model,
  };
};

export default messages;
