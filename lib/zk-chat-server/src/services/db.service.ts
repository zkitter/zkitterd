import {GenericService} from "../utils/svc";
import {Dialect, Sequelize} from "sequelize";
import config from "../utils/config";

/**
 * Encapsulates the core functionality for managing user credentials as well as viewing the banned users.
 */

class DBService extends GenericService {
    sequelize: Sequelize;

    constructor() {
        super();
        if (!config.DB_DIALECT || config.DB_DIALECT === 'sqlite') {
            this.sequelize = new Sequelize({
                dialect: 'sqlite',
                storage: './zkchat.sqlite.db',
                logging: false,
            });
        } else {
            this.sequelize = new Sequelize(
                config.DB_NAME as string,
                config.DB_USERNAME as string,
                config.DB_PASSWORD,
                {
                    host: config.DB_HOST,
                    port: Number(config.DB_PORT),
                    dialect: config.DB_DIALECT as Dialect,
                    logging: false,
                },
            );
        }
    }

    async start() {

    }
}

export default DBService
