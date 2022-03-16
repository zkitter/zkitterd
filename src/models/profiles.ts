import {BIGINT, Sequelize, STRING} from "sequelize";
import {ProfileMessageSubType} from "../util/message";

type ProfileModel = {
    messageId: string;
    hash: string;
    creator: string;
    type: string;
    subtype: string;
    createdAt: number;
    key: string;
    value: string;
};

export type UserProfile = {
    name: string;
    bio: string;
    coverImage: string;
    profileImage: string;
    twitterVerification: string;
    website: string;
}

const profiles = (sequelize: Sequelize) => {
    const model = sequelize.define('profiles', {
        messageId: {
            type: STRING,
            allowNull: false,
        },
        hash: {
            type: STRING,
            allowNull: false,
            primaryKey: true,
        },
        creator: {
            type: STRING,
            allowNull: false,
        },
        type: {
            type: STRING,
            allowNull: false,
        },
        subtype: {
            type: STRING,
        },
        createdAt: {
            type: BIGINT,
            allowNull: false,
        },
        key: {
            type: STRING,
        },
        value: {
            type: STRING,
        },
    }, {
        indexes: [
            { fields: ['creator'] },
            { fields: ['subtype'] },
            { fields: ['key'] },
            { fields: ['hash'], unique: true },
            { fields: ['messageId'], unique: true },
        ],
    });

    const remove = async (hash: string) => {
        return model.destroy({
            where: {
                hash,
            },
        });
    }

    const findProfileMessage = async (name: string, subtype: ProfileMessageSubType): Promise<ProfileModel|null> => {
        let result: any = await model.findOne({
            where: {
                creator: name,
                subtype,
            },
            order: [['createdAt', 'DESC']],
        });

        if (!result) return null;

        const json = result.toJSON() as ProfileModel;

        return json;
    }

    const findOne = async (hash: string): Promise<ProfileModel|null> => {
        let result: any = await model.findOne({
            where: {
                hash,
            },
        });

        if (!result) return null;

        const json = result.toJSON() as ProfileModel;

        return json;
    }

    const createProfile = async (record: ProfileModel) => {
        return model.create(record);
    }

    return {
        model,
        remove,
        findOne,
        createProfile,
    };
}

export default profiles;