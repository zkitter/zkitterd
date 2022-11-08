import { INTEGER, Sequelize, STRING } from 'sequelize';

export type GithubAuthModel = {
  userId: string;
  username: string;
  displayName: string | null;
  followers: number;
};

const githubAuth = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'github_auth',
    {
      userId: { type: STRING },
      username: { type: STRING },
      displayName: { type: STRING },
      followers: { type: INTEGER },
    },
    {
      indexes: [
        { unique: true, fields: ['userId'] },
        { unique: true, fields: ['username'] },
        { unique: true, fields: ['displayName'] },
      ],
    }
  );

  const findUserById = async (userId: string) =>
    (await model.findOne({ where: { userId } }))?.toJSON() as GithubAuthModel;
  const findUserByUserName = async (username: string) =>
    (await model.findOne({ where: { username } }))?.toJSON() as GithubAuthModel;
  const upsertOne = async (data: GithubAuthModel) => (await model.upsert(data))[0];

  return {
    model,
    findUserById,
    findUserByUserName,
    upsertOne,
  };
};

export default githubAuth;
