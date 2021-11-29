import {Sequelize, STRING} from "sequelize";

type TwitterAuthModel = {
    userToken: string;
    userTokenSecret: string;
    userName: string;
    userId: string;
};

const twitterAuth = (sequelize: Sequelize) => {
    const model = sequelize.define('twitter_auth', {
        user_token: {
            type: STRING,
        },
        user_token_secret: {
            type: STRING,
        },
        username: {
            type: STRING,
        },
        user_id: {
            type: STRING,
        },
    }, {
        indexes: [
            {
                unique: true,
                fields: ['user_token'],
            },
            {
                unique: true,
                fields: ['username'],
            },
            {
                unique: true,
                fields: ['user_id'],
            },
        ],
    });

    const findUserByToken = async (token: string): Promise<TwitterAuthModel> => {
        const result = await model.findOne({
            where: {
                user_token: token,
            },
        });
        return result?.toJSON() as TwitterAuthModel;
    }

    const updateUserToken = async (data: TwitterAuthModel) => {
        const result = await model.findOne({
            where: {
                username: data.userName,
            },
        });

        if (result) {
            return result.update({
                user_token: data.userToken,
                user_token_secret: data.userTokenSecret,
                username: data.userName,
                user_id: data.userId,
            });
        }

        return model.create({
            user_token: data.userToken,
            user_token_secret: data.userTokenSecret,
            username: data.userName,
            user_id: data.userId,
        });
    }

    return {
        model,
        findUserByToken,
        updateUserToken,
    };
}

export default twitterAuth;