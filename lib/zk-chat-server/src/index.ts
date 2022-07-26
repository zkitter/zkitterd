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

    getDirectChatsForUser = async (address: string) => {
        return this.DB.chats?.getDirectChatsForUser(address);
    }

    addChatMessage = async (chatMessage: ChatMessage) => {
        let data, r_user, s_user;

        if (chatMessage.sender.address) {
            s_user = await this.DB.users?.getUserByAddress(chatMessage.sender.address);
            if (!s_user) throw new Error(`${chatMessage.sender} is not registered`);
        }

        if (chatMessage.receiver.address) {
            r_user = await this.DB.users?.getUserByAddress(chatMessage.receiver.address);
            if (!r_user) throw new Error(`${chatMessage.receiver} is not registered`);
        }

        if (chatMessage.type === 'DIRECT') {
            data = {
                message_id: chatMessage.messageId,
                type: chatMessage.type,
                sender_address: chatMessage.sender.address,
                sender_hash: chatMessage.sender.hash,
                sender_pubkey: chatMessage.sender.ecdh || s_user?.pubkey,
                timestamp: chatMessage.timestamp.getTime(),
                receiver_address: chatMessage.receiver.address,
                receiver_pubkey: chatMessage.receiver.ecdh || r_user?.pubkey,
                ciphertext: chatMessage.ciphertext,
                rln_serialized_proof: chatMessage.rln ? JSON.stringify(chatMessage.rln) : undefined,
                rln_root: chatMessage.rln?.publicSignals.merkleRoot.toString(16),
            };

            return this.DB.chats?.insertChatMessage(data);
        }
    }
}