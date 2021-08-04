import "isomorphic-fetch";
import {MainService} from "./util/svc";
import ENSService from "./services/ens";
import logger from "./util/logger";
import DBService from "./services/db";
import HttpService from "./services/http";

(async function initApp() {
    try {
        const main = new MainService();
        main.add('db', new DBService());
        main.add('ens', new ENSService());
        main.add('http', new HttpService());
        await main.start();
    } catch (e) {
        logger.error(e.message, {stack: e.stack});
        throw e;
    }
})();