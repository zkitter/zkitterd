import { CorsOptions } from 'cors';
import ms from 'ms';

import config from '../../util/config';

export const CORS_OPTIONS: CorsOptions = {
  credentials: true,
  origin: function (origin = '', callback) {
    callback(null, true);
  },
};

export const JWT_SECRET = config.jwtSecret;

const ONE_MB = 1048576;
export const MAX_FILE_SIZE = ONE_MB * 5;
export const MAX_PER_USER_SIZE = ONE_MB * 100;

export const SESSION_OPTIONS = {
  proxy: true,
  secret: 'autistic cat',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: ms('30d'),
  },
};
