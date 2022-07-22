import dotenv from "dotenv";

dotenv.config({path: '../../.env'});

export default {
    INTERREP_BASE_URL: process.env.INTERREP_BASE_URL || "https://api.thegraph.com/subgraphs/name/interrep/kovan",
    INTERREP_V2: process.env.INTERREP_V2 || "https://kovan.interep.link/api",
    SERVER_PORT: parseInt(process.env.SERVER_PORT || "8080") || 8080,
    SPAM_TRESHOLD: parseInt(process.env.SPAM_TRESHOLD || "2", 2) || 2,
    EPOCH_ALLOWED_DELAY_THRESHOLD: parseInt(process.env.EPOCH_ALLOWED_DELAY_THRESHOLD || "20", 20) || 20,
    ZERO_VALUE: BigInt(0),
    RLN_IDENTIFIER: parseInt(process.env.RLN_IDENTIFIER || "518137101") || 518137101,
    DELETE_MESSAGES_OLDER_THAN_DAYS: parseInt(process.env.DELETE_MESSAGES_OLDER_THAN_DAYS || "5") || 5,
    DB_DIALECT: process.env.DB_DIALECT || 'sqlite',
    DB_NAME: process.env.DB_NAME || '',
    DB_USERNAME: process.env.DB_USERNAME || '',
    DB_PASSWORD: process.env.DB_PASSWORD || '',
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: process.env.DB_PORT || 5432,
}