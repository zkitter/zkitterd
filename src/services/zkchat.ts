import {GenericService} from "../util/svc";
import {ZKChat} from "../../lib/zk-chat-server/src";

export default class ZKChatService extends GenericService {
    zkchat: ZKChat;

    constructor() {
        super();
        this.zkchat = new ZKChat();
    }

    start = async () => {
        return this.zkchat.init();
    }

}