import {BIGINT, ModelCtor, Sequelize, STRING} from "sequelize";
import {Message, MessageType, PostJSON, PostMessageSubType} from "../util/message";

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
};

const posts = (sequelize: Sequelize, meta: ModelCtor<any>) => {
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
    }, {
        indexes: [
            { fields: ['creator'] },
            { fields: ['type'] },
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
            },
            meta: {
                replyCount: m?.replyCount || 0,
                likeCount: m?.likeCount || 0,
                repostCount: m?.repostCount || 0,
            },
        };
    }

    const findAllPosts = async (offset = 0, limit = 20, order: 'DESC' | 'ASC' = 'DESC'): Promise<PostJSON[]> => {
        let result = await model.findAll({
            where: {
                reference: '',
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
        return model.create(record);
    }

    return {
        model,
        findOne,
        findAllPosts,
        createPost,
    };
}

export default posts;