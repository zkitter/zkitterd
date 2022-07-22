import {MainService, logger} from "./utils/svc";
import ChatService from "./services/chat.service";
import DBService from "./services/db.service";

export class ZKChat {
    private main: MainService;

    constructor() {
        try {
            this.main = new MainService();
            this.main.add('db', new DBService());
            this.main.add('chat', new ChatService());
        } catch (e) {
            logger.error(e.message, {stack: e.stack});
            throw e;
        }
    }

    async init() {
        return this.main.start();
    }
}