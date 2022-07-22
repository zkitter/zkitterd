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
    // logger.add(new winston.transports.Console({
    //     level: 'info',
    //     format: winston.format.simple(),
    // }));
}

let callerId = 0;

export class GenericService {
    name: string;
    main?: MainService;

    constructor() {
        this.name = '';
    }

    async call(name: string, methodName: string, ...args: any[]) {
        const id = callerId++;
        // logger.debug(`called ${name}.${methodName}`, {
        //     ...args,
        //     origin: this.name,
        //     id: id,
        // });

        if (this.main) {
            const service: any = this.main.services[name];
            const method = service[methodName];
            if (typeof method === 'function') {
                try {
                    const resp = await method.apply(service, args);
                    // logger.debug(`handled ${name}.${methodName}`, {
                    //     origin: this.name,
                    //     id: id,
                    // });
                    return resp;
                } catch (e) {
                    logger.error(e.message, {
                        method: `${name}.${methodName}`,
                        origin: this.name,
                        id: id,
                    });
                    return Promise.reject(e);
                }
            } else {
                logger.error(`${name}.${methodName} is not a function`, {
                    origin: this.name,
                    id: id,
                });
                return Promise.reject(new Error(`${name}.${methodName} is not a function`));
            }
        }

        logger.error('main service not found', {
            origin: this.name,
            id: id,
        });

        return Promise.reject(new Error('Main service not found'));
    }

    async start() {

    }

    async stop() {

    }
}

export class MainService extends GenericService {
    services: {
        [name: string]: GenericService;
    };

    constructor() {
        super();
        this.services = {};
        this.main = this;
    }

    get = (name: string) => this.services[name];

    add(name: string, service: GenericService): MainService {
        service.name = name;
        this.services[name] = service;
        service.main = this;
        logger.info(`added ${name}`, {
            service: name,
        });
        return this;
    }

    async start() {
        for (const name in this.services) {
            logger.info(`starting ${name}`, {
                service: name,
            });
            try {
                await this.services[name].start();
                logger.info(`started ${name}`, {
                    service: name,
                });
            } catch (e) {
                logger.error(e.message, {
                    service: name,
                });
                return Promise.reject(e);
            }

        }
    }
}