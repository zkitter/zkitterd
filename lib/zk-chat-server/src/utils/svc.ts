import winston from "winston";
const format = winston.format;
const { combine, timestamp, prettyPrint } = format;

export const logger = winston.createLogger({
    level: 'info',
    format: combine(
        timestamp(),
        format.colorize(),
        format.json(),
    ),
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
    logger.add(new winston.transports.Console({
        level: 'info',
        format: winston.format.simple(),
    }));
}

export class GenericService {
    async start() {

    }

    async stop() {

    }
}