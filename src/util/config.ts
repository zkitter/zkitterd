import fs from "fs";
import path from "path";

let json: {
    interrepAPI?: string;
    web3HttpProvider?: string;
    arbitrumHttpProvider?: string;
    arbitrumRegistrar?: string;
    arbitrumPrivateKey?: string;
    arbitrumAddress?: string;
    ensResolver?: string;
    interrepContract?: string;
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
const arbitrumHttpProvider = json.arbitrumHttpProvider || process.env.ARB_HTTP_PROVIDER;
const arbitrumRegistrar = json.arbitrumRegistrar || process.env.ARB_REGISTRAR;
const arbitrumPrivateKey = json.arbitrumPrivateKey || process.env.ARB_PRIVATE_KEY;
const arbitrumAddress = json.arbitrumAddress || process.env.ARB_ADDRESS;
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
const interrepAPI = json.interrepAPI || process.env.INTERREP_API || 'https://kovan.interrep.link';
const interrepContract = json.interrepContract || process.env.INTERREP_CONTRACT || '';

if (!web3HttpProvider) {
    throw new Error('WEB3_HTTP_PROVIDER is not valid');
}

if (!ensResolver) {
    throw new Error('ENS_RESOLVER is not valid');
}

if (!arbitrumHttpProvider) {
    throw new Error('ARC_HTTP_PROVIDER is not valid');
}

if (!arbitrumRegistrar) {
    throw new Error('ARB_REGISTRAR is not valid');
}

if (!arbitrumPrivateKey) {
    throw new Error('ARB_PRIVATE_KEY is not valid');
}

if (!arbitrumAddress) {
    throw new Error('ARB_ADDRESS is not valid');
}

const config = {
    interrepAPI,
    web3HttpProvider,
    arbitrumHttpProvider,
    arbitrumRegistrar,
    arbitrumPrivateKey,
    arbitrumAddress,
    ensResolver,
    interrepContract,
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