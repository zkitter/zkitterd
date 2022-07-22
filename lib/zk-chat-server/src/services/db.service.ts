import {GenericService} from "../utils/svc";
import {Dialect, Sequelize} from "sequelize";
import config from "../utils/config";
import chats from "../models/chat.model";
import users from "../models/user.model";

/**
 * Encapsulates the core functionality for managing user credentials as well as viewing the banned users.
 */

class DBService extends GenericService {
    sequelize: Sequelize;
    chats?: ReturnType<typeof chats>;
    users?: ReturnType<typeof users>;

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
        this.chats = await chats(this.sequelize);
        this.users = await users(this.sequelize);

        await this.chats.model.sync({ force: !!process.env.FORCE });
        await this.users.model.sync({ force: !!process.env.FORCE });
    }
}

export default DBService
