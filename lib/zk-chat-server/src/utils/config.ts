import dotenv from "dotenv";

const {parsed} = dotenv.config({path: './lib/zk-chat-server/.env'});

export default {
    INTERREP_BASE_URL: parsed?.INTERREP_BASE_URL || "https://api.thegraph.com/subgraphs/name/interrep/kovan",
    INTERREP_V2: parsed?.INTERREP_V2 || "https://kovan.interep.link/api",
    SERVER_PORT: parseInt(parsed?.SERVER_PORT || "8080") || 8080,
    SPAM_TRESHOLD: parseInt(parsed?.SPAM_TRESHOLD || "2", 2) || 2,
    EPOCH_ALLOWED_DELAY_THRESHOLD: parseInt(parsed?.EPOCH_ALLOWED_DELAY_THRESHOLD || "20", 20) || 20,
    ZERO_VALUE: BigInt(0),
    RLN_IDENTIFIER: parseInt(parsed?.RLN_IDENTIFIER || "518137101") || 518137101,
    DELETE_MESSAGES_OLDER_THAN_DAYS: parseInt(parsed?.DELETE_MESSAGES_OLDER_THAN_DAYS || "5") || 5,
    DB_DIALECT: parsed?.DB_DIALECT || 'sqlite',
    DB_NAME: parsed?.DB_NAME || '',
    DB_USERNAME: parsed?.DB_USERNAME || '',
    DB_PASSWORD: parsed?.DB_PASSWORD || '',
    DB_HOST: parsed?.DB_HOST || 'localhost',
    DB_PORT: parsed?.DB_PORT || 5432,
}