import { Sequelize, STRING } from 'sequelize';

export type AuthModel = {
  userId: string;
  provider: string;
  username: string;
  token: string;
};

const auth = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'auth',
    {
      userId: { type: STRING },
      provider: { type: STRING },
      username: { type: STRING },
      token: { type: STRING },
    },
    {
      indexes: [{ unique: true, fields: ['userId'] }],
    }
  );

  const findTokenByUserId = async (username: string) => {
    const record = await model.findOne({ where: { username }, attributes: ['token'] });
    return (record?.toJSON() as AuthModel | undefined)?.token;
  };

  const findToken = async (username: string, provider: string) => {
    const record = await model.findOne({ where: { username, provider }, attributes: ['token'] });
    return (record?.toJSON() as AuthModel | undefined)?.token;
  };

  const upsertOne = async (data: AuthModel) => (await model.upsert(data))[0];

  return {
    model,
    findTokenByUserId,
    findToken,
    upsertOne,
  };
};

export default auth;
