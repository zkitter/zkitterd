import {GenericService} from "../../util/svc";
import {Dialect, Sequelize} from "sequelize";
import app from "../../models/app";
import config from "../../util/config";
import logger from "../../util/logger";
import users from "../../models/users";
import records from "../../models/records";

export default class DBService extends GenericService {
    sequelize: Sequelize;
    app?: ReturnType<typeof app>;
    users?: ReturnType<typeof users>;
    records?: ReturnType<typeof records>;

    constructor() {
        super();

        if (!config.dbDialect || config.dbDialect === 'sqlite') {
            this.sequelize = new Sequelize({
                dialect: 'sqlite',
                storage: config.dbStorage,
            });
        } else {
            this.sequelize = new Sequelize(
                config.dbName as string,
                config.dbUsername as string,
                config.dbPassword,
                {
                    host: config.dbHost,
                    port: Number(config.dbPort),
                    dialect: config.dbDialect as Dialect,
                },
            );
        }
    }

    async getRecords(): Promise<ReturnType<typeof records>> {
        if (!this.records) {
            return Promise.reject(new Error('records is not initialized'));
        }
        return this.records;
    }

    async getUsers(): Promise<ReturnType<typeof users>> {
        if (!this.users) {
            return Promise.reject(new Error('users is not initialized'));
        }
        return this.users;
    }

    async getApp(): Promise<ReturnType<typeof app>> {
        if (!this.app) {
            return Promise.reject(new Error('app is not initialized'));
        }
        return this.app;
    }

    async start() {
        this.app = await app(this.sequelize);
        this.users = await users(this.sequelize);
        this.records = await records(this.sequelize);

        await this.app?.model.sync({ force: false });
        await this.users?.model.sync({ force: false });
        await this.records?.model.sync({ force: false });

        const appData = await this.app?.read();

        if (!appData) {
            await this.app?.updateLastENSBlock(12957300);
        }
    }
}