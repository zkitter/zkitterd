import { BIGINT, Sequelize, STRING } from 'sequelize';

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
};

const profiles = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'profiles',
    {
      createdAt: {
        allowNull: false,
        type: BIGINT,
      },
      creator: {
        allowNull: false,
        type: STRING,
      },
      hash: {
        allowNull: false,
        primaryKey: true,
        type: STRING,
      },
      key: {
        type: STRING,
      },
      messageId: {
        allowNull: false,
        type: STRING,
      },
      subtype: {
        type: STRING,
      },
      type: {
        allowNull: false,
        type: STRING,
      },
      value: {
        type: STRING,
      },
    },
    {
      indexes: [
        { fields: ['creator'] },
        { fields: ['subtype'] },
        { fields: ['key'] },
        { fields: ['hash'], unique: true },
        { fields: ['messageId'], unique: true },
      ],
    }
  );

  const getAll = async (): Promise<ProfileModel[]> => {
    const list = await model.findAll<any>();
    return list.map(data => data.toJSON());
  };

  const remove = async (hash: string) => {
    return model.destroy({
      where: {
        hash,
      },
    });
  };

  const findOne = async (hash: string): Promise<ProfileModel | null> => {
    const result: any = await model.findOne({
      where: {
        hash,
      },
    });

    if (!result) return null;

    const json = result.toJSON() as ProfileModel;

    return json;
  };

  const createProfile = async (record: ProfileModel) => {
    return model.create(record);
  };

  return {
    createProfile,
    findOne,
    model,
    remove,
    getAll,
  };
};

export default profiles;
