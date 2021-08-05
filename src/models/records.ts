import {BIGINT, Sequelize, STRING} from "sequelize";

type RecordModel = {
    soul: string;
    field: string;
    value: string;
    state: number;
};

const records = (sequelize: Sequelize) => {
    const model = sequelize.define('records', {
        soul: {
            type: STRING,
        },
        field: {
            type: STRING,
        },
        value: {
            type: STRING,
        },
        state: {
            type: BIGINT,
        },
    }, {
        indexes: [
            {
                fields: ['soul'],
            },
            {
                unique: true,
                fields: ['soul', 'field'],
            }
        ],
    });

    const findOne = async (soul: string, field: string): Promise<RecordModel|null> => {
        let result = await model.findOne({
            where: {
                soul,
                field,
            },
        });

        return result?.toJSON() as RecordModel || null;
    }

    const findAll = async (soul: string): Promise<RecordModel[]> => {
        let result = await model.findAll({
            where: {
                soul,
            },
        });

        return result.map(r => r.toJSON() as RecordModel);
    }

    const readAll = async (offset = 0, limit = 20): Promise<RecordModel[]> => {
        let result = await model.findAll({
            offset,
            limit,
        });

        return result.map(r => r.toJSON() as RecordModel);
    }

    const updateOrCreateRecord = async (record: RecordModel) => {
        const result = await model.findOne({
            where: {
                soul: record.soul,
                field: record.field,
            }
        });

        const json = result?.toJSON() as RecordModel;

        if (json?.state >= record.state) {
            return Promise.resolve();
        }

        if (result) {
            return result.update(record);
        }

        return model.create(record);
    }

    return {
        model,
        findOne,
        findAll,
        readAll,
        updateOrCreateRecord,
    };
}

export default records;