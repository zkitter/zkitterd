import { Sequelize, STRING } from 'sequelize';

export type AuthModel = {
  userId: string;
  provider: string;
  username: string;
  token: string;
  refreshToken: string;
};

const auth = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'auth',
    {
      provider: { type: STRING },
      refreshToken: { type: STRING },
      token: { type: STRING },
      userId: { type: STRING },
      username: { type: STRING },
    },
    {
      indexes: [{ fields: ['userId', 'provider'], unique: true }],
    }
  );

  const findTokenByUserId = async (username: string) => {
    const record = await model.findOne({
      attributes: ['token', 'refreshToken'],
      where: { username },
    });
    return (record?.toJSON() as AuthModel | undefined)?.token;
  };

  const findToken = async (username: string, provider: string) => {
    const record = await model.findOne({
      attributes: ['token', 'refreshToken'],
      where: { provider, username },
    });
    return record?.toJSON() as AuthModel | undefined;
  };

  const upsertOne = async (data: AuthModel) => (await model.upsert(data))[0];

  return {
    findToken,
    findTokenByUserId,
    model,
    upsertOne,
  };
};

export default auth;
