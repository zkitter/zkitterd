import { CorsOptions } from 'cors';
import config from '../../util/config';

export const corsOptions: CorsOptions = {
  credentials: true,
  origin: function (origin = '', callback) {
    callback(null, true);
  },
};
export const JWT_SECRET = config.jwtSecret;
const ONE_MB = 1048576;
export const maxFileSize = ONE_MB * 5;
export const maxPerUserSize = ONE_MB * 100;
