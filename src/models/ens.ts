import { Sequelize, STRING } from 'sequelize';

type ENSModel = {
  ens: string;
  address: string;
};

const ens = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'ens',
    {
      ens: {
        type: STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
        primaryKey: true,
        unique: true,
      },
      address: {
        type: STRING,
        allowNull: false,
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
        ens,
        address,
      });
    }

    return model.create({
      ens,
      address,
    });
  };

  return {
    model,
    readByENS,
    readByAddress,
    update,
  };
};

export default ens;
