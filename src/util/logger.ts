import winston from 'winston';

const format = winston.format;
const { combine, timestamp, prettyPrint } = format;

const logger = winston.createLogger({
  level: 'info',
  format: combine(timestamp(), format.colorize(), format.json()),
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
      level: 'error',
      format: winston.format.simple(),
    })
  );
}

export default logger;
