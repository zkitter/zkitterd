import winston from 'winston';

const format = winston.format;
const { combine, timestamp } = format;

const logger = winston.createLogger({
  format: combine(timestamp(), format.colorize(), format.json()),
  level: 'info',
  transports: [
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'combined.log',
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
      level: 'error',
    })
  );
}

export default logger;
