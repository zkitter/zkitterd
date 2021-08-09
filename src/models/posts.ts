import {BIGINT, Sequelize, STRING} from "sequelize";

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

const posts = (sequelize: Sequelize) => {
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
            allowNull: false,
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

    const findOne = async (hash: string): Promise<PostModel|null> => {
        let result = await model.findOne({
            where: {
                hash,
            },
        });

        return result?.toJSON() as PostModel || null;
    }

    const findAll = async (offset = 0, limit = 20): Promise<PostModel[]> => {
        let result = await model.findAll({
            offset,
            limit,
        });

        return result.map(r => r.toJSON() as PostModel);
    }

    const readAll = async (offset = 0, limit = 20): Promise<PostModel[]> => {
        let result = await model.findAll({
            offset,
            limit,
        });

        return result.map(r => r.toJSON() as PostModel);
    }

    const createPost = async (record: PostModel) => {
        return model.create(record);
    }

    return {
        model,
        findOne,
        findAll,
        readAll,
        createPost,
    };
}

export default posts;