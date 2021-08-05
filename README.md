# 0xSocial - Indexer

Indexer server for 0xSocial - a decentralized social protocol

## Development

### Configuration
You can set configuration for the server using environment variable or by creating a `config.json` file. You can see a sample of the config file in `config.sample.json`

| Name | Description |  
| ------------- |:-------------:| 
| WEB3_HTTP_PROVIDER | a valid Http provider (e.g. `https://mainnet.infura.io/v3/<project-id>`) |
| ENS_RESOLVER | contract address for ENS Public Resolver |
| DB_DIALECT | The dialect of the database you are connecting to. One of mysql, postgres, sqlite and mssql. |
| DB_STORAGE | Only used by sqlite. Defaults to ':memory:' |
| DB_NAME | The name of the database |
| DB_USERNAME | The username which is used to authenticate against the database. |
| DB_PASSWORD | The password which is used to authenticate against the database. |
| DB_HOST | The host of the relational database. |
| DB_PORT | The port of the relational database.|
| PORT | The port of the REST API server.|
| GUN_PORT | The port of the GUN relay peer.|

