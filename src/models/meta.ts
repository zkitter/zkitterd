import {BIGINT, QueryTypes, Sequelize, STRING} from "sequelize";
import {Mutex} from "async-mutex";

type MetaModel = {
    messageId: string;
    replyCount: number;
    likeCount: number;
    repostCount: number;
};

const mutex = new Mutex();

const meta = (sequelize: Sequelize) => {
    const model = sequelize.define('meta', {
        messageId: {
            type: STRING,
            allowNull: false,
            primaryKey: true,
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
            { fields: ['messageId'], unique: true },
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
            };
            values.push(meta);
        }

        return values[0] ? values[0] : {
            liked: null,
            reposted: null,
            replyCount: 0,
            repostCount: 0,
            likeCount: 0,
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
            acc[row.messageId] = row;
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
            };
            values[reference] = meta;
        }

        return values;
    }

    const addLike = async (messageId: string) => {
        return mutex.runExclusive(async () => {
            const result = await model.findOne({
                where: {
                    messageId,
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
                messageId,
                likeCount: 1,
                replyCount: 0,
                repostCount: 0,
            });

            return res;
        });
    }

    const addReply = async (messageId: string) => {
        return mutex.runExclusive(async () => {
            const result = await model.findOne({
                where: { messageId },
            });

            if (result) {
                const data = result.toJSON() as MetaModel;
                return result.update({
                    ...data,
                    replyCount: Number(data.replyCount) + 1,
                });
            }

            const res = await model.create({
                messageId,
                likeCount: 0,
                replyCount: 1,
                repostCount: 0,
            });

            return res;
        });
    }

    const addRepost = async (messageId: string) => {
        return mutex.runExclusive(async () => {
            const result = await model.findOne({
                where: {
                    messageId,
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
                messageId,
                likeCount: 0,
                replyCount: 0,
                repostCount: 1,
            });

            return res;
        });
    }

    return {
        model,
        findOne,
        findMany,
        addLike,
        addReply,
        addRepost,
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
    mt."messageId"
FROM meta mt
    LEFT JOIN moderations m ON m."messageId" = (SELECT "messageId" FROM moderations WHERE reference = mt."messageId" AND creator = :context AND subtype = 'LIKE' LIMIT 1)
    LEFT JOIN posts rp ON rp."messageId" = (SELECT "messageId" from posts WHERE mt."messageId" = reference AND creator = :context AND subtype = 'REPOST' LIMIT 1)
WHERE mt."messageId" = :reference
`;

const selectManyMetaQuery = `
SELECT
    m."messageId" as liked,
    rp."messageId" as reposted,
    mt."replyCount",
    mt."repostCount",
    mt."likeCount",
    mt."messageId"
FROM meta mt
    LEFT JOIN moderations m ON m."messageId" = (SELECT "messageId" FROM moderations WHERE reference = mt."messageId" AND creator = :context AND subtype = 'LIKE' LIMIT 1)
    LEFT JOIN posts rp ON rp."messageId" = (SELECT "messageId" from posts WHERE mt."messageId" = reference AND creator = :context AND subtype = 'REPOST' LIMIT 1)
WHERE mt."messageId" in (:references)
`;