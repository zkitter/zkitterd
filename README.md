# Autism Node

Official Node/Typescript implementation of [Autism](https://docs.auti.sm/)

## Requirements
- Node 12.22+
- NPM 6.14+
- PostgresSQL 13

### Configurations
You can set configuration using environment variable or by creating a `config.prod.json` or `config.dev.json` file. You can see a sample of the config file [here](./config.sample.json).

| Name | Description |  
| ------------- |-------------| 
| `WEB3_HTTP_PROVIDER` | a valid Http provider (e.g. `https://mainnet.infura.io/v3/<project-id>`) |
| `ENS_RESOLVER` | contract address for ENS Public Resolver |
| `DB_DIALECT` | The dialect of the database you are connecting to. One of mysql, postgres, sqlite and mssql. |
| `DB_STORAGE` | Only used by sqlite. Defaults to `:memory:` |
| `DB_NAME` | The name of the database |
| `DB_USERNAME` | The username which is used to authenticate against the database. |
| `DB_PASSWORD` | The password which is used to authenticate against the database. |
| `DB_HOST` | The host of the relational database. |
| `DB_PORT` | The port of the relational database. |
| `PORT` | The port of the REST API server. Defaults to `3000`|
| `GUN_PORT` | The port of the GUN relay peer. Defaults to `8765`|
| `GUN_PEERS` | Seed peers to connect to for GunDB. |
| `RAPIDAPI_KEY` | API Key from [Rapid API](https://rapidapi.com/hub). This is for calculating reputation score on twitter account. |
| `TW_CALLBACK_URL` | Callback API for twitter oauth 1.0a Defaults to `http://127.0.0.1:3000/twitter/callback`. |
| `TW_CONSUMER_KEY` | Twitter API Consumer Key. |
| `TW_CONSUMER_SECRET` | Twitter API Consumer Secret. |
| `TW_BEARER_TOKEN` | Twitter API Bearer Token. |
| `TW_ACCESS_KEY` | Twitter API Access Token. |
| `TW_ACCESS_SECRET` | Twitter API Access Secret. |
| `ARB_HTTP_PROVIDER` | a valid Http provider to Arbitrum network (e.g. `https://arbitrum.infura.io/v3/<project-id>`). |
| `ARB_REGISTRAR` | Contract address for the [Autism registration contract](https://github.com/autism-org/contracts). |
| `ARB_PRIVATE_KEY` | Private Key to the Arbitrum address to be used to fund onboarding. |
| `ARB_ADDRESS` | The Arbitrum address to be used to fund onboarding. |
| `MODERATORS` | Global moderations for the server. Defaults to `0x3F425586D68616A113C29c303766DAD444167EE8` and `0xd44a82dD160217d46D754a03C8f841edF06EBE3c` |

## Build Instructions

**Installation**
```
npm i
```

**Unit test**
```
npm t
```

**Developement Build**
```
npm run build-server
```

**Production Build**
```
npm run build
```

**Run in development**
```
npm run dev
```

**Run in production**
```
npm start
```
