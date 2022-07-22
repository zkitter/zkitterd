import {logger} from "./utils/svc";
import Chat, {ChatMessage} from "./services/chat.service";
import DB from "./services/db.service";



export class ZKChat {
    DB: DB;
    Chat: Chat;

    constructor() {
        this.DB = new DB();
        this.Chat = new Chat();
    }

    async init() {
        try {
            await this.DB.start();
            await this.Chat.start();
        } catch (e) {
            logger.error(e.message, {stack: e.stack});
            throw e;
        }
    }

    registerUser = async (address: string, ecdhPubkey: string) => {
        return this.DB.users?.insertUser(address, ecdhPubkey);
    }

    getAllUsers = async (offset = 0, limit = 20) => {
        return this.DB.users?.getUsers(offset, limit);
    }

    getDirectMessages = async (sender: string, receiver: string, offset = 0, limit = 20) => {
        return this.DB.chats?.getDirectMessages(sender, receiver, offset, limit);
    }

    addChatMessage = async (chatMessage: ChatMessage) => {
        let data;

        if (chatMessage.sender) {
            const user = await this.DB.users?.getUserByAddress(chatMessage.sender);
            if (!user) throw new Error(`${chatMessage.sender} is not registered`);
        }

        if (chatMessage.type === 'DIRECT') {
            data = {
                message_id: chatMessage.messageId,
                type: chatMessage.type,
                sender_address: chatMessage.sender,
                timestamp: chatMessage.timestamp.getTime(),
                // sender_pubkey?: string;
                // rln_serialized_proof?: string;
                // rln_root?: string;
                receiver_address: chatMessage.receiver,
                ciphertext: chatMessage.ciphertext,
            };

            return this.DB.chats?.insertChatMessage(data);
        }

    }
}