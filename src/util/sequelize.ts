import config from './config';
import { Dialect, Sequelize } from 'sequelize';

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
      {
        host: config.dbHost,
        port: Number(config.dbPort),
        dialect: config.dbDialect as Dialect,
        logging: false,
      }
    );
  }

  return cached;
}

export const sequelize = getSequelize();
