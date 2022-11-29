import { Sequelize, STRING } from 'sequelize';

export type GithubAuthModel = {
  username: string;
  token: string;
};

const githubAuth = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'github_auth',
    {
      username: { type: STRING },
      token: { type: STRING },
    },
    {
      indexes: [{ unique: true, fields: ['username'] }],
    }
  );

  const findTokenByUsername = async (username: string) => {
    const record = await model.findOne({ where: { username }, attributes: ['token'] });
    return (record?.toJSON() as GithubAuthModel | undefined)?.token;
  };

  const upsertOne = async (data: GithubAuthModel) => (await model.upsert(data))[0];

  return {
    model,
    findTokenByUsername,
    upsertOne,
  };
};

export default githubAuth;
