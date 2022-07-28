import {Sequelize, BIGINT, STRING} from "sequelize";

type MerkleRootModel = {
    root_hash: string;
    group_id: string;
};

const merkleRoot = (sequelize: Sequelize) => {
    const model = sequelize.define('merkle_root', {
        root_hash: {
            type: STRING,
        },
        group_id: {
            type: STRING,
        },
    }, {
        indexes: [
            { fields: ['root_hash'], unique: true },
            { fields: ['group_id'] },
        ],
    });

    const getGroupByRoot = async (root_hash: string): Promise<MerkleRootModel> => {
        let result = await model.findOne({
            where: {
                root_hash,
            },
        });

        return result?.toJSON() as MerkleRootModel;
    }

    const addRoot = async (root_hash: string, group_id: string) => {
        const exist = await model.findOne({
            where: {
                root_hash,
            },
        });

        if (!exist) {
            return model.create({
                root_hash,
                group_id,
            });
        }

    }

    return {
        model,
        addRoot,
        getGroupByRoot,
    };
};

export default merkleRoot