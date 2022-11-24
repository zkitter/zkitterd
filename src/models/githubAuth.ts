import { Sequelize, STRING } from 'sequelize';

export type GithubAuthModel = {
  userId: string;
  accessToken: string;
};

const githubAuth = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'github_auth',
    {
      userId: { type: STRING },
      accessToken: { type: STRING },
    },
    {
      indexes: [{ unique: true, fields: ['userId'] }],
    }
  );

  const findUserById = async (userId: string) =>
    (
      await model.findOne({ where: { userId }, attributes: ['accessToken'] })
    )?.toJSON() as GithubAuthModel;
  const upsertOne = async (data: GithubAuthModel) => (await model.upsert(data))[0];

  return {
    model,
    findUserById,
    upsertOne,
  };
};

export default githubAuth;
