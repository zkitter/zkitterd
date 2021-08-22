import {BIGINT, ModelCtor, Sequelize, STRING} from "sequelize";
import {Message, MessageType, ModerationJSON, PostJSON, PostMessageSubType} from "../util/message";

type ModerationModel = {
    messageId: string;
    hash: string;
    creator: string;
    type: string;
    subtype: string;
    createdAt: number;
    reference: string;
    referenceCreator: string;
    referenceHash: string;
};

const moderations = (sequelize: Sequelize) => {
    const model = sequelize.define('moderations', {
        messageId: {
            type: STRING,
            allowNull: false,
        },
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
        referenceCreator: {
            type: STRING,
        },
        referenceHash: {
            type: STRING,
        },
    }, {
        indexes: [
            { fields: ['creator'] },
            { fields: ['subtype'] },
            { fields: ['referenceCreator'] },
            { fields: ['referenceHash'] },
            { fields: ['hash'], unique: true },
            { fields: ['messageId'], unique: true },
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
