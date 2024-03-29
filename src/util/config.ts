import { readFileSync } from 'fs';
import { join } from 'path';

import { isDocker, isProd, isTest } from './env';

let json: {
  interrepAPI?: string;
  web3HttpProvider?: string;
  arbitrumHttpProvider?: string;
  goerliHttpProvider?: string;
  arbitrumRegistrar?: string;
  arbitrumPrivateKey?: string;
  arbitrumAddress?: string;
  lastArbitrumBlock?: string;
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
  moderators?: string[];
  jwtSecret?: string;
  ghPat?: string;
  ghCallbackUrl?: string;
  ghClientId?: string;
  ghClientSecret?: string;
  rdCallbackUrl?: string;
  rdClientId?: string;
  rdClientSecret?: string;
  twCallbackUrl?: string;
  twConsumerKey?: string;
  twClientId?: string; // OAuth 2.0 Client ID in twitter dev portal
  twClientSecret?: string; // OAuth 2.0 Client Secret in twitter dev portal
  twConsumerSecret?: string;
  twBearerToken?: string;
  twAccessKey?: string;
  twAccessSecret?: string;
  rapidAPIKey?: string;
  web3StorageAPIKey?: string;
} = {};

try {
  const configBuffer = isDocker
    ? readFileSync('/run/secrets/config', 'utf8').trim()
    : isProd
    ? readFileSync(join(process.cwd(), 'config.prod.json'))
    : isTest
    ? readFileSync(join(process.cwd(), 'config.test.json'))
    : readFileSync(join(process.cwd(), 'config.dev.json'));

  json = JSON.parse(configBuffer.toString('utf-8'));
} catch (e) {
  console.error(e);
}

const rapidAPIKey = json.rapidAPIKey || process.env.RAPIDAPI_KEY;
const ghPat = json.ghPat || process.env.GH_PAT;
const ghCallbackUrl = json.ghCallbackUrl || process.env.GH_CALLBACK_URL;
const ghClientId = json.ghClientId || process.env.GH_CLIENT_ID;
const ghClientSecret = json.ghClientSecret || process.env.GH_CLIENT_SECRET;
const rdCallbackUrl = json.rdCallbackUrl || process.env.RD_CALLBACK_URL;
const rdClientId = json.rdClientId || process.env.RD_CLIENT_ID;
const rdClientSecret = json.rdClientSecret || process.env.RD_CLIENT_SECRET;
const twCallbackUrl = json.twCallbackUrl || process.env.TW_CALLBACK_URL;
const twClientId = json.twClientId || process.env.TW_CLIENT_ID;
const twClientSecret = json.twClientSecret || process.env.TW_CLIENT_SECRET;
const twConsumerKey = json.twConsumerKey || process.env.TW_CONSUMER_KEY;
const twConsumerSecret = json.twConsumerSecret || process.env.TW_CONSUMER_SECRET;
const twBearerToken = json.twBearerToken || process.env.TW_BEARER_TOKEN;
const twAccessKey = json.twAccessKey || process.env.TW_ACCESS_KEY;
const twAccessSecret = json.twAccessSecret || process.env.TW_ACCESS_SECRET;
const web3HttpProvider = json.web3HttpProvider || process.env.WEB3_HTTP_PROVIDER;
const ensResolver = json.ensResolver || process.env.ENS_RESOLVER;
const arbitrumHttpProvider = json.arbitrumHttpProvider || process.env.ARB_HTTP_PROVIDER;
const goerliHttpProvider = json.goerliHttpProvider || process.env.GOERLI_HTTP_PROVIDER;
const arbitrumRegistrar = json.arbitrumRegistrar || process.env.ARB_REGISTRAR;
const arbitrumPrivateKey = json.arbitrumPrivateKey || process.env.ARB_PRIVATE_KEY;
const arbitrumAddress = json.arbitrumAddress || process.env.ARB_ADDRESS;
const lastArbitrumBlock = json.lastArbitrumBlock || process.env.LAST_ARBITRUM_BLOCK;
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
const moderators = json.moderators ||
  process.env?.MODERATORS?.split(' ') || [
    '0x3F425586D68616A113C29c303766DAD444167EE8',
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
  ];
const interrepAPI = json.interrepAPI || process.env.INTERREP_API || 'https://kovan.interep.link';
const interrepContract = json.interrepContract || process.env.INTERREP_CONTRACT || '';
const jwtSecret = json.jwtSecret || process.env.JWT_SECRET || 'topjwtsecret';
const web3StorageAPIKey = json.web3StorageAPIKey || process.env.WEB3_STORAGE_API_KEY;

if (!web3HttpProvider) throw new Error('WEB3_HTTP_PROVIDER is not valid');
if (!ensResolver) throw new Error('ENS_RESOLVER is not valid');
if (!arbitrumHttpProvider) throw new Error('ARC_HTTP_PROVIDER is not valid');
if (!goerliHttpProvider) throw new Error('GOERLI_HTTP_PROVIDER is not valid');
if (!arbitrumRegistrar) throw new Error('ARB_REGISTRAR is not valid');
if (!arbitrumPrivateKey) throw new Error('ARB_PRIVATE_KEY is not valid');
if (!arbitrumAddress) throw new Error('ARB_ADDRESS is not valid');
if (!jwtSecret) throw new Error('JWT_SECRET is not valid');
if (!ghPat) throw new Error('Github Personal Access Token config missing');
if (!ghCallbackUrl) throw new Error(`ghCallbackUrl config missing`);
if (!ghClientId) throw new Error(`ghClientId config missing`);
if (!ghClientSecret) throw new Error(`ghClientSecret config missing`);
if (!rdCallbackUrl) throw new Error(`rdCallbackUrl config missing`);
if (!rdClientId) throw new Error(`rdClientId config missing`);
if (!rdClientSecret) throw new Error(`rdClientSecret config missing`);
if (!twCallbackUrl) throw new Error(`twCallbackUrl is not valid`);
if (!twClientId) throw new Error(`twClientId is not valid`);
if (!twClientSecret) throw new Error(`twClientSecret is not valid`);
if (!twConsumerKey) throw new Error(`twConsumerKey is not valid`);
if (!twConsumerSecret) throw new Error(`twConsumerSecret is not valid`);
if (!twBearerToken) throw new Error(`twBearerToken is not valid`);
if (!twAccessKey) throw new Error(`twAccessKey is not valid`);
if (!twAccessSecret) throw new Error(`twAccessSecret is not valid`);
if (!rapidAPIKey) throw new Error(`rapidAPIKey is not valid`);
if (!web3StorageAPIKey) throw new Error(`web3StorageAPIKey is not valid`);

const config = {
  arbitrumAddress,
  arbitrumHttpProvider,
  arbitrumPrivateKey,
  arbitrumRegistrar,
  dbDialect,
  dbHost,
  dbName,
  dbPassword,
  dbPort,
  dbStorage,
  dbUsername,
  ensResolver,
  ghCallbackUrl,
  ghClientId,
  ghClientSecret,
  ghPat,
  goerliHttpProvider,
  gunPeers,
  gunPort: gunPort ? Number(gunPort) : 8765,
  interrepAPI,
  interrepContract,
  jwtSecret,
  lastArbitrumBlock: Number(lastArbitrumBlock),
  moderators,
  port: port ? Number(port) : 3000,
  rapidAPIKey,
  rdCallbackUrl,
  rdClientId,
  rdClientSecret,
  twAccessKey,
  twAccessSecret,
  twBearerToken,
  twCallbackUrl,
  twClientId,
  twClientSecret,
  twConsumerKey,
  twConsumerSecret,
  web3HttpProvider,
  web3StorageAPIKey,
};

export default config;
