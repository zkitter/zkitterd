import { Mutex } from 'async-mutex';
import { Sequelize, STRING } from 'sequelize';

const mutex = new Mutex();

type TwitterAuthModel = {
  userToken: string;
  userTokenSecret: string;
  userName: string;
  userId: string;
};

const twitterAuth = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'twitter_auth',
    {
      account: {
        type: STRING,
      },
      user_id: {
        type: STRING,
      },
      user_token: {
        type: STRING,
      },
      user_token_secret: {
        type: STRING,
      },
      username: {
        type: STRING,
      },
    },
    {
      indexes: [
        {
          fields: ['user_token'],
          unique: true,
        },
        {
          fields: ['username'],
          unique: true,
        },
        {
          fields: ['user_id'],
          unique: true,
        },
        {
          fields: ['account'],
          unique: true,
        },
      ],
    }
  );

  const findUserByToken = async (token?: string | null): Promise<TwitterAuthModel | null> => {
    if (!token) return null;

    const result = await model.findOne({
      where: {
        user_token: token,
      },
    });

    return result?.toJSON() as TwitterAuthModel;
  };

  const findUserByUsername = async (username: string): Promise<TwitterAuthModel | null> => {
    if (!username) return null;

    const result = await model.findOne({
      where: {
        username: username,
      },
    });

    return result?.toJSON() as TwitterAuthModel;
  };

  const findUserByAccount = async (account: string): Promise<TwitterAuthModel | null> => {
    if (!account) return null;

    const result = await model.findOne({
      where: {
        account: account,
      },
    });

    return result?.toJSON() as TwitterAuthModel;
  };

  const addAccount = async (username: string, account: string) => {
    return mutex.runExclusive(async () => {
      const result = await model.findOne({
        where: {
          username: username,
        },
      });

      if (result) {
        const json: any = await result?.toJSON();

        if (json.username !== username) throw new Error(`${username} already exists`);

        return result.update({
          account,
        });
      }

      return model.create({
        account,
        username,
      });
    });
  };

  const updateUserToken = async (data: TwitterAuthModel) => {
    return mutex.runExclusive(async () => {
      const result = await model.findOne({
        where: {
          username: data.userName,
        },
      });

      if (result) {
        return result.update({
          user_id: data.userId,
          user_token: data.userToken,
          user_token_secret: data.userTokenSecret,
          username: data.userName,
        });
      }

      return model.create({
        user_id: data.userId,
        user_token: data.userToken,
        user_token_secret: data.userTokenSecret,
        username: data.userName,
      });
    });
  };

  return {
    addAccount,
    findUserByAccount,
    findUserByToken,
    findUserByUsername,
    model,
    updateUserToken,
  };
};

export default twitterAuth;
