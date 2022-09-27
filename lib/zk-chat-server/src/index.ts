import {logger} from "./utils/svc";
import Chat, {ChatMessage} from "./services/chat.service";
import DB from "./services/db.service";
import config from "./utils/config";
import {RLN, RLNFullProof, Semaphore, SemaphoreFullProof} from "@zk-kit/protocols";
import vkey from "../statics/circuitFiles/rln/verification_key.json";
import semaphoreVkey from "../statics/circuitFiles/semaphore/verification_key.json";
import {ShareModel} from "./models/shares.model";

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

    checkShare = async (share: ShareModel) => {
        return this.DB.shares?.checkShare(share);
    }

    insertShare = async (share: ShareModel) => {
        return this.DB.shares?.insertShare(share);
    }

    isEpochCurrent = async (epoch: string) => {
        const serverTimestamp = new Date();
        // serverTimestamp.setSeconds(Math.floor(serverTimestamp.getSeconds() / 10) * 10);
        serverTimestamp.setMilliseconds(0);
        const messageTimestamp = new Date(parseInt(epoch));

        // Tolerate a difference of EPOCH_ALLOWED_DELAY_THRESHOLD seconds between client and server timestamp
        const difference_in_seconds = Math.abs(serverTimestamp.getTime() - messageTimestamp.getTime()) / 1000;
        if (difference_in_seconds >= config.EPOCH_ALLOWED_DELAY_THRESHOLD) {
            return false;
        }

        return true;
    }

    verifyRLNProof = async (proof: RLNFullProof) => {
        return RLN.verifyProof(
            vkey as any,
            proof,
        );
    }

    verifySemaphoreProof = async (proof: SemaphoreFullProof) => {
        return Semaphore.verifyProof(
            semaphoreVkey as any,
            proof,
        );
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
                sender_address: chatMessage.sender.hash
                    ? undefined
                    : chatMessage.sender.address,
                sender_hash: chatMessage.sender.hash,
                sender_pubkey: chatMessage.sender.ecdh || s_user?.pubkey,
                timestamp: chatMessage.timestamp.getTime(),
                receiver_address: chatMessage.receiver.address,
                receiver_pubkey: chatMessage.receiver.ecdh || r_user?.pubkey,
                ciphertext: chatMessage.ciphertext,
                rln_serialized_proof: chatMessage.rln ? JSON.stringify(chatMessage.rln) : undefined,
                rln_root: chatMessage.rln
                    ? '0x' + BigInt(chatMessage.rln?.publicSignals.merkleRoot).toString(16)
                    : undefined,
            };

            await this.DB.chats?.insertChatMessage(data);
        }

        return data;
    }
}