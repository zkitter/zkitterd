import {BIGINT, QueryTypes, Sequelize, STRING} from "sequelize";
import {Mutex} from "async-mutex";

type MetaModel = {
    reference: string;
    replyCount: number;
    likeCount: number;
    repostCount: number;
    postCount: number;
};

const mutex = new Mutex();

const emptyMeta = {
    replyCount: 0,
    likeCount: 0,
    repostCount: 0,
    postCount: 0,
};

const meta = (sequelize: Sequelize) => {
    const model = sequelize.define('meta', {
        reference: {
            type: STRING,
            allowNull: false,
            primaryKey: true,
        },
        postCount: {
            type: BIGINT,
        },
        replyCount: {
            type: BIGINT,
        },
        likeCount: {
            type: BIGINT,
        },
        repostCount: {
            type: BIGINT,
        },
    }, {
        indexes: [
            { fields: ['reference'], unique: true },
        ],
    });

    const findOne = async (reference: string, context = ''): Promise<any|null> => {
        const result = await sequelize.query(`
            ${selectMetaQuery}
        `, {
            replacements: {
                context: context || '',
                reference,
            },
            type: QueryTypes.SELECT,
        });

        const values: any[] = [];

        for (let r of result) {
            const row = r as any;
            const meta = {
                liked: row.liked,
                reposted: row.reposted,
                replyCount: row.replyCount ? Number(row.replyCount) : 0,
                repostCount: row.repostCount ? Number(row.repostCount) : 0,
                likeCount: row.likeCount ? Number(row.likeCount) : 0,
                postCount: row.postCount ? Number(row.postCount) : 0,
            };
            values.push(meta);
        }

        return values[0] ? values[0] : {
            liked: null,
            reposted: null,
            ...emptyMeta,
        };
    }

    const findMany = async (references: string[], context = ''): Promise<any|null> => {
        const result = await sequelize.query(`
            ${selectManyMetaQuery}
        `, {
            replacements: {
                context: context || '',
                references,
            },
            type: QueryTypes.SELECT,
        });

        const mapping = result.reduce((acc: any, row: any) => {
            acc[row.reference] = row;
            return acc;
        }, {});

        const values: any = {};

        for (let i = 0; i < references.length; i++) {
            const reference = references[i];
            const row = mapping[reference] as any;
            const meta = {
                liked: row?.liked || null,
                reposted: row?.reposted || null,
                replyCount: row?.replyCount ? Number(row?.replyCount) : 0,
                repostCount: row?.repostCount ? Number(row?.repostCount) : 0,
                likeCount: row?.likeCount ? Number(row?.likeCount) : 0,
                postCount: row?.postCount ? Number(row?.postCount) : 0,
            };
            values[reference] = meta;
        }

        return values;
    }

    const findTags = async (
        offset = 0,
        limit = 20,
    ) => {
        const result = await sequelize.query(`
            SELECT
                "reference",
                "postCount"
            from meta
            WHERE "reference" LIKE '#%'
            ORDER BY "postCount" DESC
            LIMIT :limit OFFSET :offset
        `, {
            replacements: {
                limit,
                offset,
            },
            type: QueryTypes.SELECT,
        });

        return result.map((r: any) => ({
            tagName: r.reference,
            postCount: Number(r.postCount),
        }));
    }

    const addLike = async (reference: string) => {
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
                    likeCount: Number(data.likeCount) + 1,
                });
            }

            const res = await model.create({
                reference,
                ...emptyMeta,
                likeCount: 1,
            });

            return res;
        });
    }

    const addReply = async (reference: string) => {
        return mutex.runExclusive(async () => {
            const result = await model.findOne({
                where: { reference },
            });

            if (result) {
                const data = result.toJSON() as MetaModel;
                return result.update({
                    ...data,
                    replyCount: Number(data.replyCount) + 1,
                });
            }

            const res = await model.create({
                reference,
                ...emptyMeta,
                replyCount: 1,
            });

            return res;
        });
    }

    const addRepost = async (reference: string) => {
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
                    repostCount: Number(data.repostCount) + 1,
                });
            }

            const res = await model.create({
                reference,
                ...emptyMeta,
                repostCount: 1,
            });

            return res;
        });
    }

    const addPost = async (reference: string) => {
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
                    postCount: Number(data.postCount) + 1,
                });
            }

            const res = await model.create({
                reference,
                ...emptyMeta,
                postCount: 1,
            });

            return res;
        });
    }

    return {
        model,
        findOne,
        findMany,
        findTags,
        addLike,
        addReply,
        addRepost,
        addPost,
    };
}

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

const selectManyMetaQuery = `
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
WHERE mt."reference" in (:references)
`;