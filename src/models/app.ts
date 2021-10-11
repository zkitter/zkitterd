import {Sequelize, BIGINT} from "sequelize";

type AppModel = {
    lastENSBlockScanned: number;
    lastInterrepBlockScanned: number;
    lastArbitrumBlockScanned: number;
};

const app = (sequelize: Sequelize) => {
    const model = sequelize.define('app', {
        lastENSBlockScanned: {
            type: BIGINT,
        },
        lastInterrepBlockScanned: {
            type: BIGINT,
        },
        lastArbitrumBlockScanned: {
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

    const updateLastArbitrumBlock = async (blockHeight: number) => {
        const result = await model.findOne();

        if (result) {
            return result.update({
                lastArbitrumBlockScanned: blockHeight,
            });
        }

        return model.create({
            lastArbitrumBlockScanned: blockHeight,
        });
    }

    return {
        model,
        read,
        updateLastENSBlock,
        updateLastInterrepBlock,
        updateLastArbitrumBlock,
    };
}

export default app;