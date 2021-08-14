import {BIGINT, ModelCtor, ModelStatic, Sequelize, STRING, WhereOptions} from "sequelize";
import {MessageType, PostJSON, PostMessageSubType} from "../util/message";
import {Mutex} from "async-mutex";
const mutex = new Mutex();

type PostModel = {
    hash: string;
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

const posts = (sequelize: Sequelize, meta: ModelCtor<any>, moderations: ModelCtor<any>) => {
    const model = sequelize.define('posts', {
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
        topic: {
            type: STRING,
            allowNull: false,
        },
        title: {
            type: STRING,
            allowNull: false,
        },
        content: {
            type: STRING,
            allowNull: false,
        },
        reference: {
            type: STRING,
        },
        attachment: {
            type: STRING,
        },
    }, {
        indexes: [
            { fields: ['creator'] },
            { fields: ['subtype'] },
            { fields: ['topic'] },
            { fields: ['reference'] },
            { fields: ['hash'], unique: true }
        ],
    });

    const findOne = async (hash: string): Promise<PostJSON|null> => {
        let result: any = await model.findOne({
            where: {
                hash,
            },
            include: {
                model: meta,
                as: 'meta',
            },
        });

        if (!result) return null;

        const json = result.toJSON() as PostModel;
        const m = result.meta && result.meta.toJSON();

        return {
            type: json.type as MessageType,
            subtype: json.subtype as PostMessageSubType,
            messageId: `${json.creator}/${json.hash}`,
            hash: json.hash,
            createdAt: json.createdAt,
            payload: {
                topic: json.topic,
                title: json.title,
                content: json.content,
                reference: json.reference,
                attachment: json.attachment,
            },
            meta: {
                replyCount: m?.replyCount || 0,
                likeCount: m?.likeCount || 0,
                repostCount: m?.repostCount || 0,
            },
        };
    }

    const findAllPosts = async (
        creator?: string,
        offset = 0,
        limit = 20,
        order: 'DESC' | 'ASC' = 'DESC',
    ): Promise<PostJSON[]> => {
        const where: WhereOptions<PostModel> = {
            subtype: [PostMessageSubType.Default, PostMessageSubType.Repost],
        };

        if (creator) where.creator = creator;

        let result = await model.findAll({
            where: where,
            offset,
            limit,
            order: [['createdAt', order]],
            include: [
                {
                    model: meta,
                    as: 'meta',
                },
            ],
        });

        return result.map((r: any) => {
            const json = r.toJSON() as PostModel;
            const m = r.meta && r.meta.toJSON();

            return {
                type: json.type as MessageType,
                subtype: json.subtype as PostMessageSubType,
                messageId: `${json.creator}/${json.hash}`,
                hash: json.hash,
                createdAt: json.createdAt,
                payload: {
                    topic: json.topic,
                    title: json.title,
                    content: json.content,
                    reference: json.reference,
                    attachment: json.attachment,
                },
                meta: {
                    replyCount: m?.replyCount || 0,
                    likeCount: m?.likeCount || 0,
                    repostCount: m?.repostCount || 0,
                },
            };
        });
    }

    const findAllReplies = async (reference: string, offset = 0, limit = 20, order: 'DESC' | 'ASC' = 'ASC'): Promise<PostJSON[]> => {
        let result = await model.findAll({
            where: {
                reference,
                subtype: [PostMessageSubType.Reply],
            },
            offset,
            limit,
            order: [['createdAt', order]],
            include: {
                model: meta,
                as: 'meta',
            },
        });

        return result.map((r: any) => {
            const json = r.toJSON() as PostModel;
            const m = r.meta && r.meta.toJSON();

            return {
                type: json.type as MessageType,
                subtype: json.subtype as PostMessageSubType,
                messageId: `${json.creator}/${json.hash}`,
                hash: json.hash,
                createdAt: json.createdAt,
                payload: {
                    topic: json.topic,
                    title: json.title,
                    content: json.content,
                    reference: json.reference,
                    attachment: json.attachment,
                },
                meta: {
                    replyCount: m?.replyCount || 0,
                    likeCount: m?.likeCount || 0,
                    repostCount: m?.repostCount || 0,
                },
            };
        });
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
                    return result.update(record);
                }
            }

            return model.create(record);
        });
    }

    const ensurePost = async (hash: string) => {
        return mutex.runExclusive(async () => {
            const result = await model.findOne({
                where: {
                    hash: hash,
                }
            });

            if (!result) {
                const emptyModel: PostModel = {
                    hash: hash,
                    type: MessageType.Post,
                    subtype: PostMessageSubType.Default,
                    creator: '',
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
        createPost,
        ensurePost,
    };
}

export default posts;