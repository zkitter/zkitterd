import {GenericService} from "../../util/svc";
import {Dialect, Sequelize} from "sequelize";
import app from "../../models/app";
import config from "../../util/config";
import logger from "../../util/logger";
import users from "../../models/users";
import records from "../../models/records";
import posts from "../../models/posts";
import meta from "../../models/meta";

export default class DBService extends GenericService {
    sequelize: Sequelize;
    app?: ReturnType<typeof app>;
    users?: ReturnType<typeof users>;
    records?: ReturnType<typeof records>;
    posts?: ReturnType<typeof posts>;
    meta?: ReturnType<typeof meta>;

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

    async getPosts(): Promise<ReturnType<typeof posts>> {
        if (!this.posts) {
            return Promise.reject(new Error('posts is not initialized'));
        }
        return this.posts;
    }

    async getMeta(): Promise<ReturnType<typeof meta>> {
        if (!this.meta) {
            return Promise.reject(new Error('meta is not initialized'));
        }

        return this.meta;
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
        this.meta = await meta(this.sequelize);
        this.posts = await posts(this.sequelize, this.meta?.model);

        this.meta?.model.belongsTo(this.posts?.model, {
            foreignKey: 'hash',
        });


        this.posts?.model.hasOne(this.meta?.model, {
            foreignKey: 'hash',
            as: 'meta',
        });

        await this.app?.model.sync({ force: true });
        await this.users?.model.sync({ force: true });
        await this.records?.model.sync({ force: true });
        await this.meta?.model.sync({ force: true });
        await this.posts?.model.sync({ force: true });

        const appData = await this.app?.read();

        if (!appData) {
            await this.app?.updateLastENSBlock(12957300);
        }
    }
}