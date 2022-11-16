import { Dialect, Sequelize } from 'sequelize';

import config from './config';

const options =
  process.env.NODE_ENV === 'test'
    ? {
        host: config.dbHost,
        port: Number(config.dbPort),
        dialect: config.dbDialect as Dialect,
        logging: false,
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        },
      }
    : {
        host: config.dbHost,
        port: Number(config.dbPort),
        dialect: config.dbDialect as Dialect,
        logging: false,
      };

let cached: Sequelize;

function getSequelize(): Sequelize {
  if (cached) return sequelize;

  if (!config.dbDialect || config.dbDialect === 'sqlite') {
    cached = new Sequelize({
      dialect: 'sqlite',
      storage: config.dbStorage,
      logging: false,
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
