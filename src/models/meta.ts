import { Mutex } from 'async-mutex';
import { BIGINT, QueryTypes, Sequelize, STRING } from 'sequelize';

type MetaModel = {
  reference: string;
  replyCount: number;
  likeCount: number;
  repostCount: number;
  postCount: number;
};

const mutex = new Mutex();

const emptyMeta = {
  likeCount: 0,
  postCount: 0,
  replyCount: 0,
  repostCount: 0,
};

const meta = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'meta',
    {
      likeCount: {
        type: BIGINT,
      },
      postCount: {
        type: BIGINT,
      },
      reference: {
        allowNull: false,
        primaryKey: true,
        type: STRING,
      },
      replyCount: {
        type: BIGINT,
      },
      repostCount: {
        type: BIGINT,
      },
    },
    {
      indexes: [{ fields: ['reference'], unique: true }],
    }
  );

  const findOne = async (reference: string, context = ''): Promise<any | null> => {
    const result = await sequelize.query(
      `
            ${selectMetaQuery}
        `,
      {
        replacements: {
          context: context || '',
          reference,
        },
        type: QueryTypes.SELECT,
      }
    );

    const values: any[] = [];

    for (const r of result) {
      const row = r as any;
      const meta = {
        likeCount: row.likeCount ? Number(row.likeCount) : 0,
        liked: row.liked,
        postCount: row.postCount ? Number(row.postCount) : 0,
        replyCount: row.replyCount ? Number(row.replyCount) : 0,
        repostCount: row.repostCount ? Number(row.repostCount) : 0,
        reposted: row.reposted,
      };
      values.push(meta);
    }

    return values[0]
      ? values[0]
      : {
          liked: null,
          reposted: null,
          ...emptyMeta,
        };
  };

  const findTags = async (offset = 0, limit = 20) => {
    const result = await sequelize.query(
      `
            SELECT
                "reference",
                "postCount"
            from meta
            WHERE "reference" LIKE '#%'
            ORDER BY "postCount" DESC
            LIMIT :limit OFFSET :offset
        `,
      {
        replacements: {
          limit,
          offset,
        },
        type: QueryTypes.SELECT,
      }
    );

    return result.map((r: any) => ({
      postCount: Number(r.postCount),
      tagName: r.reference,
    }));
  };

  const update = async (record: MetaModel) => {
    return mutex.runExclusive(async () => {
      return model.create(record);
    });
  };

  return {
    addLike: makeIncrementer('likeCount', 1),
    addPost: makeIncrementer('postCount', 1),
    addReply: makeIncrementer('replyCount', 1),
    addRepost: makeIncrementer('repostCount', 1),
    findOne,
    findTags,
    model,
    removeLike: makeIncrementer('likeCount', -1),
    removePost: makeIncrementer('postCount', -1),
    removeReply: makeIncrementer('replyCount', -1),
    removeRepost: makeIncrementer('repostCount', -1),
    update,
  };

  function makeIncrementer(key: string, delta: number) {
    return async (reference: string) => {
      return mutex.runExclusive(async () => {
        const result = await model.findOne({
          where: {
            reference,
          },
        });

        if (result) {
          const data = result.toJSON() as MetaModel;
          return result.update({
            ...data,
            // @ts-expect-error
            [key]: Math.max(0, (Number(data[key]) || 0) + delta),
          });
        }

        return await model.create({
          reference,
          ...emptyMeta,
          [key]: Math.max(0, delta),
        });
      });
    };
  }
};

export default meta;

const selectMetaQuery = `
SELECT
    m."messageId" as liked,
    rp."messageId" as reposted,
    mt."replyCount",
    mt."repostCount",
    mt."likeCount",
    mt."reference"
FROM meta mt
    LEFT JOIN moderations m ON m."messageId" = (SELECT "messageId" FROM moderations WHERE reference = mt."reference" AND creator = :context AND subtype = 'LIKE' LIMIT 1)
    LEFT JOIN posts rp ON rp."messageId" = (SELECT "messageId" from posts WHERE mt."reference" = reference AND creator = :context AND subtype = 'REPOST' LIMIT 1)
WHERE mt."reference" = :reference
`;
