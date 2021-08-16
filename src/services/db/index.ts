import {GenericService} from "../../util/svc";
import {Dialect, Sequelize} from "sequelize";
import app from "../../models/app";
import config from "../../util/config";
import logger from "../../util/logger";
import users from "../../models/users";
import records from "../../models/records";
import posts from "../../models/posts";
import meta from "../../models/meta";
import moderations from "../../models/moderations";
import profiles from "../../models/profiles";
import userMeta from "../../models/userMeta";
import connections from "../../models/connections";

export default class DBService extends GenericService {
    sequelize: Sequelize;
    app?: ReturnType<typeof app>;
    users?: ReturnType<typeof users>;
    records?: ReturnType<typeof records>;
    posts?: ReturnType<typeof posts>;
    profiles?: ReturnType<typeof profiles>;
    moderations?: ReturnType<typeof moderations>;
    connections?: ReturnType<typeof connections>;
    meta?: ReturnType<typeof meta>;
    userMeta?: ReturnType<typeof userMeta>;

    constructor() {
        super();

        if (!config.dbDialect || config.dbDialect === 'sqlite') {
            this.sequelize = new Sequelize({
                dialect: 'sqlite',
                storage: config.dbStorage,
                logging: false,
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
                    logging: false,
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

    async getConnections(): Promise<ReturnType<typeof connections>> {
        if (!this.connections) {
            return Promise.reject(new Error('connections is not initialized'));
        }
        return this.connections;
    }

    async getModerations(): Promise<ReturnType<typeof moderations>> {
        if (!this.moderations) {
            return Promise.reject(new Error('moderations is not initialized'));
        }
        return this.moderations;
    }

    async getProfiles(): Promise<ReturnType<typeof profiles>> {
        if (!this.profiles) {
            return Promise.reject(new Error('profiles is not initialized'));
        }

        return this.profiles;
    }

    async getMeta(): Promise<ReturnType<typeof meta>> {
        if (!this.meta) {
            return Promise.reject(new Error('meta is not initialized'));
        }

        return this.meta;
    }

    async getUserMeta(): Promise<ReturnType<typeof userMeta>> {
        if (!this.userMeta) {
            return Promise.reject(new Error('userMeta is not initialized'));
        }

        return this.userMeta;
    }

    async getApp(): Promise<ReturnType<typeof app>> {
        if (!this.app) {
            return Promise.reject(new Error('app is not initialized'));
        }
        return this.app;
    }

    async start() {
        this.app = await app(this.sequelize);
        this.records = await records(this.sequelize);
        this.meta = await meta(this.sequelize);
        this.userMeta = await userMeta(this.sequelize);
        this.moderations = await moderations(this.sequelize);
        this.connections = await connections(this.sequelize);
        this.users = await users(this.sequelize, this.userMeta);
        this.posts = await posts(
            this.sequelize,
            this.meta,
            this.moderations,
        );
        this.profiles = await profiles(this.sequelize);

        // this.meta?.model.belongsTo(this.posts?.model, {
        //     foreignKey: 'hash',
        // });

        // this.moderations?.model.belongsTo(this.posts?.model, {
        //     foreignKey: 'reference',
        // });

        this.posts?.model.hasMany(this.moderations?.model, {
            foreignKey: 'referenceHash',
            sourceKey: 'hash',
            as: 'moderations',
        });

        this.posts?.model.hasOne(this.meta?.model, {
            foreignKey: 'hash',
            as: 'meta',
        });

        this.users?.model.hasOne(this.userMeta?.model, {
            foreignKey: 'name',
            as: 'meta',
        });

        await this.app?.model.sync({ force: true });
        await this.userMeta?.model.sync({ force: true });
        await this.users?.model.sync({ force: true });
        await this.records?.model.sync({ force: true });
        await this.meta?.model.sync({ force: true });
        await this.moderations?.model.sync({ force: true });
        await this.connections?.model.sync({ force: true });
        await this.profiles?.model.sync({ force: true });
        await this.posts?.model.sync({ force: true });

        const appData = await this.app?.read();

        if (!appData) {
            await this.app?.updateLastENSBlock(12957300);
        }
    }
}