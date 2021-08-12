import {BIGINT, ModelCtor, Sequelize, STRING} from "sequelize";
import {Message, MessageType, ModerationJSON, PostJSON, PostMessageSubType} from "../util/message";

type ModerationModel = {
    hash: string;
    creator: string;
    type: string;
    subtype: string;
    createdAt: number;
    reference: string;
};

const moderations = (sequelize: Sequelize) => {
    const model = sequelize.define('moderations', {
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
        reference: {
            type: STRING,
        },
    }, {
        indexes: [
            { fields: ['creator'] },
            { fields: ['type'] },
            { fields: ['subtype'] },
            { fields: ['reference'] },
            { fields: ['hash'], unique: true }
        ],
    });

    const findOne = async (hash: string): Promise<ModerationModel|null> => {
        let result: any = await model.findOne({
            where: {
                hash,
            },
        });

        if (!result) return null;

        const json = result.toJSON() as ModerationModel;

        return json;
    }

    const findAllByReference = async (
        reference: string,
        offset = 0,
        limit = 20,
        order: 'DESC' | 'ASC' = 'DESC',
    ): Promise<ModerationJSON[]> => {
        let result = await model.findAll({
            where: {
                reference,
            },
            offset,
            limit,
            order: [['createdAt', order]],
        });

        return result.map((r: any) => r.toJSON() as ModerationJSON);
    }

    const createModeration = async (record: ModerationModel) => {
        return model.create(record);
    }

    return {
        model,
        findOne,
        findAllByReference,
        createModeration,
    };
}

export default moderations;