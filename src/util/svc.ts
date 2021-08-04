import logger from "./logger";

let callerId = 0;

export class GenericService {
    name: string;
    main?: MainService;

    constructor() {
        this.name = '';
    }

    async call(name: string, methodName: string, ...args: any[]) {
        const id = callerId++;
        logger.info(`called ${name}.${methodName}`, {
            ...args,
            origin: this.name,
            id: id,
        });

        if (this.main) {
            const service: any = this.main.services[name];
            const method = service[methodName];
            if (typeof method === 'function') {
                try {
                    const resp = await method.apply(service, args);
                    logger.info(`handled ${name}.${methodName}`, {
                        origin: this.name,
                        id: id,
                    });
                    return resp;
                } catch (e) {
                    logger.error(e.message, {
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

    }

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