import {GenericService} from "../util/svc";
import {ZKChat} from "../../lib/zk-chat-server/src";
import {ChatMessage} from "../../lib/zk-chat-server/src/services/chat.service";

export default class ZKChatService extends GenericService {
    zkchat: ZKChat;

    constructor() {
        super();
        this.zkchat = new ZKChat();
    }

    start = async () => {
        return this.zkchat.init();
    }

    registerUser = async (address: string, ecdhPubkey: string) => {
        return this.zkchat.registerUser(address, ecdhPubkey);
    }

    getAllUsers = async (offset = 0, limit = 20) => {
        return this.zkchat.getAllUsers(offset, limit);
    }

    addChatMessage = async (chatMessage: ChatMessage) => {
        return this.zkchat.addChatMessage(chatMessage);
    }

    getDirectMessages = async (sender: string, receiver: string, offset = 0, limit = 20) => {
        return this.zkchat.getDirectMessages(sender, receiver, offset, limit);
    }
}