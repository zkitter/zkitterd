import {BIGINT, Sequelize, STRING} from "sequelize";
import {Mutex} from "async-mutex";

type ProposalMetaModel = {
    proposal_id: string;
    space_id: string;
    choice: number;
    score: number;
};

const mutex = new Mutex();

const proposalMeta = (sequelize: Sequelize) => {
    const model = sequelize.define('proposal_meta', {
        proposal_id: {
            type: STRING,
        },
        space_id: {
            type: STRING,
        },
        choice: {
            type: BIGINT,
        },
        score: {
            type: BIGINT,
        },
    }, {
        indexes: [
            { fields: ['proposal_id', 'choice'], unique: true },
            { fields: ['proposal_id'] },
        ],
    });

    const getProposalMeta = async (proposal_id: string): Promise<number[]> => {
        let result = await model.findAll({
            where: {
                proposal_id,
            },
        });

        if (!result) return [];

        return result?.map(r => (r.toJSON() as ProposalMetaModel).score) || [];
    }

    const getProposalMetas = async (proposal_ids: string[]): Promise<{ [id: string]: number[] }> => {
        let result = await model.findAll({
            where: {
                proposal_id: proposal_ids,
            },
        });

        if (!result) return {};

        const scores: { [id: string]: number[] } = {};

        for (const r of result) {
            const json = r.toJSON() as ProposalMetaModel;
            scores[json.proposal_id] = scores[json.proposal_id] || [];
            const bucket = scores[json.proposal_id];
            bucket[json.choice] = json.score;
        }

        return scores;
    }

    const createProposalMeta = async (meta: ProposalMetaModel) => {
        return mutex.runExclusive(async () => {
            return model.create(meta);
        });
    }

    return {
        model,
        getProposalMeta,
        getProposalMetas,
        createProposalMeta,
    };
}

export default proposalMeta;