import {Sequelize, BIGINT} from "sequelize";

type AppModel = {
    lastENSBlockScanned: number;
};

const app = (sequelize: Sequelize) => {
    const model = sequelize.define('app', {
        lastENSBlockScanned: {
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

    return {
        model,
        read,
        updateLastENSBlock,
    };
}

export default app;