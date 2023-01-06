import { Dialect, Sequelize } from 'sequelize';

import config from './config';

const options =
  process.env.NODE_ENV === 'test'
    ? {
        dialect: config.dbDialect as Dialect,
        dialectOptions: {
          ssl: {
            rejectUnauthorized: false,
            require: true,
          },
        },
        host: config.dbHost,
        logging: false,
        port: Number(config.dbPort),
      }
    : {
        dialect: config.dbDialect as Dialect,
        host: config.dbHost,
        logging: false,
        port: Number(config.dbPort),
      };

let cached: Sequelize;

function getSequelize(): Sequelize {
  if (cached) return sequelize;

  if (!config.dbDialect || config.dbDialect === 'sqlite') {
    cached = new Sequelize({
      dialect: 'sqlite',
      logging: false,
      storage: config.dbStorage,
    });
  } else {
    cached = new Sequelize(
      config.dbName as string,
      config.dbUsername as string,
      config.dbPassword,
      options
    );
  }

  return cached;
}

export const sequelize = getSequelize();
