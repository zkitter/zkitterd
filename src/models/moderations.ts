import { BIGINT, ModelCtor, QueryTypes, Sequelize, STRING } from 'sequelize';
import {
    Message,
    MessageType,
    ModerationJSON,
    PostJSON,
    PostMessageSubType,
} from '../util/message';
import { PostModel } from './posts';

type ModerationModel = {
    messageId: string;
    hash: string;
    creator: string;
    type: string;
    subtype: string;
    createdAt: number;
    reference: string;
};

const moderations = (sequelize: Sequelize) => {
    const model = sequelize.define(
        'moderations',
        {
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
        },
        {
            indexes: [
                { fields: ['creator'] },
                { fields: ['subtype'] },
                { fields: ['hash'], unique: true },
                { fields: ['messageId'], unique: true },
            ],
        }
    );

    const findOne = async (hash: string): Promise<ModerationModel | null> => {
        let result: any = await model.findOne({
            where: {
                hash,
            },
        });

        if (!result) return null;

        const json = result.toJSON() as ModerationModel;

        return json;
    };

    const remove = async (hash: string) => {
        return model.destroy({
            where: {
                hash,
            },
        });
    };

    const findThreadModeration = async (message_id: string) => {
        const result = await sequelize.query(
            `
            SELECT 
                m."messageId",
                m.creator,
                m.reference,
                m.type,
                m.subtype,
                m.hash,
                m."createdAt",
                m."updatedAt"
            FROM threads t
            JOIN posts p ON p."messageId" = t.root_id
            JOIN moderations m ON m.reference = t.message_id AND m.creator = p.creator AND m.subtype IN ('THREAD_HIDE_BLOCK', 'THREAD_ONLY_MENTION', 'THREAD_SHOW_FOLLOW')
            WHERE t.message_id = :message_id
        `,
            {
                replacements: {
                    message_id,
                },
                type: QueryTypes.SELECT,
            }
        );

        if (result) {
            return result;
        }

        return null;
    };

    const findAllByReference = async (
        reference: string,
        offset = 0,
        limit = 20,
        order: 'DESC' | 'ASC' = 'DESC'
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
    };

    const createModeration = async (record: ModerationModel) => {
        return model.create(record);
    };

    return {
        model,
        findOne,
        remove,
        findAllByReference,
        findThreadModeration,
        createModeration,
    };
};

export default moderations;
