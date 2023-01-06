import { Sequelize, STRING } from 'sequelize';

type ENSModel = {
  ens: string;
  address: string;
};

const ens = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'ens',
    {
      address: {
        allowNull: false,
        type: STRING,
        validate: {
          notEmpty: true,
        },
      },
      ens: {
        allowNull: false,
        primaryKey: true,
        type: STRING,
        unique: true,
        validate: {
          notEmpty: true,
        },
      },
    },
    {
      indexes: [{ fields: ['ens'] }, { fields: ['address'] }],
    }
  );

  const readByAddress = async (address: string): Promise<ENSModel> => {
    const result = await model.findOne({
      where: { address },
    });
    return result?.toJSON() as ENSModel;
  };

  const readByENS = async (ens: string): Promise<ENSModel> => {
    const result = await model.findOne({
      where: { ens },
    });
    return result?.toJSON() as ENSModel;
  };

  const update = async (ens: string, address: string) => {
    const result = await model.findOne({
      where: { ens },
    });

    if (result) {
      return result.update({
        address,
        ens,
      });
    }

    return model.create({
      address,
      ens,
    });
  };

  return {
    model,
    readByAddress,
    readByENS,
    update,
  };
};

export default ens;
