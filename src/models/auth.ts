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
      userId: { type: STRING },
      provider: { type: STRING },
      username: { type: STRING },
      token: { type: STRING },
      refreshToken: { type: STRING },
    },
    {
      indexes: [{ unique: true, fields: ['userId', 'provider'] }],
    }
  );

  const findTokenByUserId = async (username: string) => {
    const record = await model.findOne({
      where: { username },
      attributes: ['token', 'refreshToken'],
    });
    return (record?.toJSON() as AuthModel | undefined)?.token;
  };

  const findToken = async (username: string, provider: string) => {
    const record = await model.findOne({
      where: { username, provider },
      attributes: ['token', 'refreshToken'],
    });
    return record?.toJSON() as AuthModel | undefined;
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
