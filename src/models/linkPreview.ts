import {Sequelize, BIGINT, STRING} from "sequelize";

type LinkPreviewModel = {
    link: string;
    title: string;
    description: string;
    image: string;
    mediaType: string;
    contentType: string;
    favicon: string;
};

const linkPreview = (sequelize: Sequelize) => {
    const model = sequelize.define('link', {
        title: {
            type: STRING,
        },
        image: {
            type: STRING,
        },
        description: {
            type: STRING,
        },
        link: {
            type: STRING,
            unique: true,
        },
        mediaType: {
            type: STRING,
        },
        contentType: {
            type: STRING,
        },
        favicon: {
            type: STRING,
        },
    }, {
        indexes: [
            { fields: ['link'], unique: true },
        ],
    });

    const read = async (link: string): Promise<LinkPreviewModel> => {
        let result = await model.findOne({
            where: {
                link,
            },
        });

        return result?.toJSON() as LinkPreviewModel;
    }

    const update = async (linkPreview: LinkPreviewModel) => {
        const result = await model.findOne();

        if (result) {
            return result.update(linkPreview);
        }

        return model.create(linkPreview);
    }

    return {
        model,
        read,
        update,
    };
}

export default linkPreview;