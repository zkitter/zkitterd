import { Mutex } from 'async-mutex';
import { BIGINT, Sequelize, STRING } from 'sequelize';

type UserMetaModel = {
  name: string;
  followerCount: number;
  followingCount: number;
  blockedCount: number;
  blockingCount: number;
  mentionedCount: number;
  postingCount: number;
};

const mutex = new Mutex();

const emptyMeta = {
  blockedCount: 0,
  blockingCount: 0,
  followerCount: 0,
  followingCount: 0,
  mentionedCount: 0,
  postingCount: 0,
};

const userMeta = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'usermeta',
    {
      blockedCount: {
        type: BIGINT,
      },
      blockingCount: {
        type: BIGINT,
      },
      followerCount: {
        type: BIGINT,
      },
      followingCount: {
        type: BIGINT,
      },
      mentionedCount: {
        type: BIGINT,
      },
      name: {
        allowNull: false,
        primaryKey: true,
        type: STRING,
      },
      postingCount: {
        type: BIGINT,
      },
    },
    {
      indexes: [{ fields: ['name'], unique: true }],
    }
  );

  const findOne = async (name: string): Promise<UserMetaModel | null> => {
    const result = await model.findOne({
      where: {
        name,
      },
    });

    return (
      (result?.toJSON() as UserMetaModel) || {
        ...emptyMeta,
      }
    );
  };

  const update = async (record: UserMetaModel) => {
    return model.create(record);
  };

  return {
    addBlocked: makeKeyIncrementer('blockedCount', 1),
    addBlocking: makeKeyIncrementer('blockingCount', 1),
    addFollower: makeKeyIncrementer('followerCount', 1),
    addFollowing: makeKeyIncrementer('followingCount', 1),
    addMentionedCount: makeKeyIncrementer('mentionedCount', 1),
    addPostingCount: makeKeyIncrementer('postingCount', 1),
    findOne,
    model,
    removeBlocked: makeKeyIncrementer('blockedCount', -1),
    removeBlocking: makeKeyIncrementer('blockingCount', -1),
    removeFollower: makeKeyIncrementer('followerCount', -1),
    removeFollowing: makeKeyIncrementer('followingCount', -1),
    removeMentionedCount: makeKeyIncrementer('mentionedCount', -1),
    removePostingCount: makeKeyIncrementer('postingCount', -1),
    update,
  };

  function makeKeyIncrementer(key: string, delta: number) {
    return async (name: string) => {
      return mutex.runExclusive(async () => {
        const result = await model.findOne({
          where: { name },
        });

        if (result) {
          const data = result.toJSON() as UserMetaModel;
          return result.update({
            ...data,
            // @ts-expect-error
            [key]: Math.max(0, (Number(data[key]) || 0) + delta),
          });
        }

        return await model.create({
          name,
          ...emptyMeta,
          [key]: Math.max(0, delta),
        });
      });
    };
  }
};

export default userMeta;
