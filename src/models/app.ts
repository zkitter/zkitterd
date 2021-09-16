import {Sequelize, BIGINT} from "sequelize";

type AppModel = {
    lastENSBlockScanned: number;
    lastInterrepBlockScanned: number;
};

const app = (sequelize: Sequelize) => {
    const model = sequelize.define('app', {
        lastENSBlockScanned: {
            type: BIGINT,
        },
        lastInterrepBlockScanned: {
            type: BIGINT,
        },
    }, {});

    const read = async (): Promise<AppModel> => {
        let result = await model.findOne();
        return result?.toJSON() as AppModel;
    }

    const updateLastENSBlock = async (blockHeight: number) => {
        const result = await model.findOne();

        if (result) {
            return result.update({
                lastENSBlockScanned: blockHeight,
            });
        }

        return model.create({
            lastENSBlockScanned: blockHeight,
        });
    }

    const updateLastInterrepBlock = async (blockHeight: number) => {
        const result = await model.findOne();

        if (result) {
            return result.update({
                lastInterrepBlockScanned: blockHeight,
            });
        }

        return model.create({
            lastInterrepBlockScanned: blockHeight,
        });
    }

    return {
        model,
        read,
        updateLastENSBlock,
        updateLastInterrepBlock,
    };
}

export default app;