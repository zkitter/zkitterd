import fs from "fs";
import path from "path";

let json: {
    web3HttpProvider?: string;
    ensResolver?: string;
    dbDialect?: string;
    dbStorage?: string;
    dbName?: string;
    dbUsername?: string;
    dbPassword?: string;
    dbHost?: string;
    dbPort?: string;
    port?: number;
    gunPort?: number;
    gunPeers?: string[];
} = {};

try {
    const configBuffer = process.env.NODE_ENV === 'development'
        ? fs.readFileSync(path.join(process.cwd(), 'config.dev.json'))
        : fs.readFileSync(path.join(process.cwd(), 'config.prod.json'));
    const parsed = JSON.parse(configBuffer.toString('utf-8'));
    json = parsed;
} catch (e) {}

const web3HttpProvider = json.web3HttpProvider || process.env.WEB3_HTTP_PROVIDER;
const ensResolver = json.ensResolver || process.env.ENS_RESOLVER;
const dbDialect = json.dbDialect || process.env.DB_DIALECT;
const dbStorage = json.dbStorage || process.env.DB_STORAGE;
const dbName = json.dbName || process.env.DB_NAME;
const dbUsername = json.dbUsername || process.env.DB_USERNAME;
const dbPassword = json.dbPassword || process.env.DB_PASSWORD;
const dbHost = json.dbHost || process.env.DB_HOST;
const dbPort = json.dbPort || process.env.DB_PORT;
const port = json.port || process.env.PORT;
const gunPort = json.gunPort || process.env.GUN_PORT;
const gunPeers = json.gunPeers || process.env?.GUN_PEERS?.split(' ') || [];

if (!web3HttpProvider) {
    throw new Error('WEB3_HTTP_PROVIDER is not valid');
}

if (!ensResolver) {
    throw new Error('ENS_RESOLVER is not valid');
}

const config = {
    web3HttpProvider,
    ensResolver,
    dbDialect,
    dbStorage,
    dbName,
    dbUsername,
    dbPassword,
    dbHost,
    dbPort,
    port: port ? Number(port) : 3000,
    gunPort: gunPort ? Number(gunPort) : 8765,
    gunPeers,
};

export default config;