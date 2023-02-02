import logger from './logger';

let callerId = 0;
let getterId = 0;

export class GenericService {
  name: string;
  main?: MainService;

  constructor() {
    this.name = '';
  }

  get(name: string, propName: string) {
    const id = getterId++;
    if (this.main) {
      const service: any = this.main.services[name];
      const prop = service[propName];

      if (prop) return prop;

      logger.error(`${name}.${prop} does not exist`, {
        id: id,
        origin: this.name,
      });

      throw new Error(`${name}.${prop} does not exist`);
    }

    logger.error('main service not found', {
      id: id,
      origin: this.name,
    });

    throw new Error('Main service not found');
  }

  async call(name: string, methodName: string, ...args: any[]) {
    const id = callerId++;

    if (this.main) {
      const service: any = this.main.services[name];
      const method = service[methodName];
      if (typeof method === 'function') {
        try {
          return method.apply(service, args);
        } catch (e) {
          logger.error(e.message, {
            id: id,
            method: `${name}.${methodName}`,
            origin: this.name,
          });
          return Promise.reject(e);
        }
      } else {
        logger.error(`${name}.${methodName} is not a function`, {
          id: id,
          origin: this.name,
        });
        return Promise.reject(new Error(`${name}.${methodName} is not a function`));
      }
    }

    logger.error('main service not found', {
      id: id,
      origin: this.name,
    });

    return Promise.reject(new Error('Main service not found'));
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async start() {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async stop() {}
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
      logger.debug(`starting ${name}`, {
        service: name,
      });
      try {
        await this.services[name].start();
        logger.debug(`started ${name}`, {
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
