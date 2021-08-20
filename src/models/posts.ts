import {BIGINT, QueryTypes, Sequelize, STRING} from "sequelize";
import {MessageType, PostJSON, PostMessageSubType} from "../util/message";
import {Mutex} from "async-mutex";

const mutex = new Mutex();

type PostModel = {
    messageId: string;
    hash: string;
    proof?: string;
    signals?: string;
    creator: string;
    type: string;
    subtype: string;
    createdAt: number;
    topic: string;
    title: string;
    content: string;
    reference: string;
    attachment: string;
};

const posts = (sequelize: Sequelize) => {
    const model = sequelize.define('posts', {
        hash: {
            type: STRING,
            allowNull: false,
            primaryKey: true,
        },
        messageId: {
            type: STRING,
            allowNull: false,
        },
        creator: {
            type: STRING,
            allowNull: false,
        },
        proof: {
            type: STRING,
        },
        signals: {
            type: STRING,
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
        topic: {
            type: STRING,
            allowNull: false,
        },
        title: {
            type: STRING(4095),
            allowNull: false,
        },
        content: {
            type: STRING(65535),
            allowNull: false,
        },
        reference: {
            type: STRING,
        },
        attachment: {
            type: STRING(4095),
        },
    }, {
        indexes: [
            { fields: ['creator'] },
            { fields: ['subtype'] },
            { fields: ['topic'] },
            { fields: ['reference'] },
            { fields: ['hash'], unique: true },
            { fields: ['messageId'], unique: true },
        ],
    });

    const findOne = async (hash: string, context?: string): Promise<PostJSON|null> => {
        const result = await sequelize.query(`
            ${selectJoinQuery}
            WHERE p.hash = :hash AND p."createdAt" != -1
        `, {
            replacements: {
                context: context || '',
                hash,
            },
            type: QueryTypes.SELECT,
        });

        const values: PostJSON[] = [];

        for (let r of result) {
            const post = inflateResultToPostJSON(r);
            if (post.createdAt > 0) {
                values.push(post);
            }
        }

        return values[0];
    }

    const findAllPosts = async (
        creator?: string,
        context?: string,
        offset = 0,
        limit = 20,
        order: 'DESC' | 'ASC' = 'DESC',
    ): Promise<PostJSON[]> => {
        const result = await sequelize.query(`
            ${selectJoinQuery}
            WHERE p.subtype != 'REPLY' AND p."createdAt" != -1${creator ? ' AND p.creator = :creator' : ''}
            ORDER BY p."createdAt" ${order}
            LIMIT :limit OFFSET :offset
        `, {
            replacements: {
                context: context || '',
                creator: creator || '',
                limit,
                offset,
            },
            type: QueryTypes.SELECT,
        });

        const values: PostJSON[] = [];

        for (let r of result) {
            const post = inflateResultToPostJSON(r);
            values.push(post);
        }

        return values;
    }

    const getHomeFeed = async (
        context?: string,
        offset = 0,
        limit = 20,
        order: 'DESC' | 'ASC' = 'DESC',
    ): Promise<PostJSON[]> => {
        const result = await sequelize.query(`
            ${selectJoinQuery}
            WHERE p.subtype != 'REPLY' AND p."createdAt" != -1 AND (
                p.creator IN (SELECT name FROM connections WHERE subtype = 'FOLLOW' AND creator = :context) OR
                p.creator = :context
            )
            ORDER BY p."createdAt" ${order}
            LIMIT :limit OFFSET :offset
        `, {
            replacements: {
                context: context || '',
                limit,
                offset,
            },
            type: QueryTypes.SELECT,
        });

        const values: PostJSON[] = [];

        for (let r of result) {
            const post = inflateResultToPostJSON(r);
            values.push(post);
        }

        return values;
    }

    const findAllReplies = async (
        reference: string,
        context?: string,
        offset = 0,
        limit = 20,
        order: 'DESC' | 'ASC' = 'ASC',
    ): Promise<PostJSON[]> => {
        const result = await sequelize.query(`
            ${selectJoinQuery}
            WHERE p.subtype = 'REPLY' AND p."createdAt" != -1 AND p.reference = :reference
            ORDER BY p."createdAt" ${order}
            LIMIT :limit OFFSET :offset
        `, {
            replacements: {
                reference,
                context: context || '',
                limit,
                offset,
            },
            type: QueryTypes.SELECT,
        });

        const values: PostJSON[] = [];
        for (let r of result) {
            const post = inflateResultToPostJSON(r);
            values.push(post);
        }

        return values;
    }

    const createPost = async (record: PostModel) => {
        return mutex.runExclusive(async () => {
            const result = await model.findOne({
                where: {
                    hash: record.hash,
                }
            });

            if (result) {
                const json = await result.toJSON() as PostModel;
                if (json.createdAt < 0) {
                    // @ts-ignore
                    await result.changed('createdAt', true);
                    await result.set('createdAt', record.createdAt, { raw: true });
                    await result.save({
                        fields: ['createdAt'],
                    });
                    return result.update(record);
                }
            }

            return model.create(record);
        });
    }

    const ensurePost = async (messageId: string) => {
        return mutex.runExclusive(async () => {
            const [creator, hash] = messageId.split('/');
            const result = await model.findOne({
                where: {
                    hash: hash || creator,
                }
            });

            if (!result) {
                const emptyModel: PostModel = {
                    messageId: messageId,
                    hash: hash || creator,
                    type: MessageType.Post,
                    subtype: PostMessageSubType.Default,
                    creator: hash ? creator : '',
                    createdAt: -1,
                    topic: '',
                    title: '',
                    content: '',
                    reference: '',
                    attachment: '',
                }
                return model.create(emptyModel);
            }
        });
    }

    return {
        model,
        findOne,
        findAllPosts,
        findAllReplies,
        getHomeFeed,
        createPost,
        ensurePost,
    };
}

export default posts;

function inflateResultToPostJSON(r: any): PostJSON {
    const json = r as any;

    const meta = {
        replyCount: json?.replyCount || 0,
        likeCount: json?.likeCount || 0,
        repostCount: json?.repostCount || 0,
        liked: json?.liked,
        reposted: json?.reposted,
    };

    if (json.subtype === PostMessageSubType.Repost) {
        meta.replyCount = json?.rpReplyCount || 0;
        meta.likeCount = json?.rpLikeCount || 0;
        meta.repostCount = json?.rpRepostCount || 0;
        meta.liked = json?.rpLiked || null;
        meta.reposted = json?.rpReposted || null;
    }

    return {
        type: json.type as MessageType,
        subtype: json.subtype as PostMessageSubType,
        messageId: json.creator ? `${json.creator}/${json.hash}` : json.hash,
        hash: json.hash,
        createdAt: json.createdAt,
        payload: {
            topic: json.topic,
            title: json.title,
            content: json.content,
            reference: json.reference,
            attachment: json.attachment,
        },
        meta: meta,
    };
}

const selectJoinQuery = `
    SELECT
        p.hash,
        p.creator,
        p.type,
        p.subtype,
        p."createdAt",
        p.topic,
        p.title,
        p.content,
        p.reference,
        p.attachment,
        m."messageId" as liked,
        rpm."messageId" as rpLiked,
        rp."messageId" as reposted,
        rprp."messageId" as rpReposted,
        mt."replyCount",
        mt."repostCount",
        mt."likeCount",
        rpmt."replyCount" as rpReplyCount,
        rpmt."repostCount" as rpRepostCount,
        rpmt."likeCount" as rpLikeCount
    FROM posts p
        LEFT JOIN moderations m ON m."messageId" = (SELECT "messageId" FROM moderations WHERE reference = p."messageId" AND creator = :context LIMIT 1)
        LEFT JOIN moderations rpm ON rpm."messageId" = (select "messageId" from moderations where reference = p.reference AND creator = :context AND p.subtype = 'REPOST' LIMIT 1)
        LEFT JOIN posts rp ON rp."messageId" = (SELECT "messageId" from posts WHERE p."messageId" = reference AND creator = :context AND subtype = 'REPOST' LIMIT 1)
        LEFT JOIN posts rprp ON rprp."messageId" = (SELECT "messageId" from posts WHERE reference = p.reference AND creator = :context AND subtype = 'REPOST' AND p.subtype = 'REPOST' LIMIT 1)
        LEFT JOIN meta mt ON mt."messageId" = p."messageId"
        LEFT JOIN meta rpmt ON p.subtype = 'REPOST' AND rpmt."messageId" = p.reference
`;