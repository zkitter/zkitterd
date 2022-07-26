import {GenericService} from "../util/svc";
import {ZKChat} from "../../lib/zk-chat-server/src";
import {ChatMessage} from "../../lib/zk-chat-server/src/services/chat.service";
import {Dialect, QueryTypes, Sequelize} from "sequelize";
import config from "../../lib/zk-chat-server/src/utils/config";

export default class ZKChatService extends GenericService {
    zkchat: ZKChat;
    sequelize: Sequelize;

    constructor() {
        super();
        this.zkchat = new ZKChat();
        this.sequelize = new Sequelize(
            config.DB_NAME as string,
            config.DB_USERNAME as string,
            config.DB_PASSWORD,
            {
                host: config.DB_HOST,
                port: Number(config.DB_PORT),
                dialect: config.DB_DIALECT as Dialect,
                logging: false,
            },
        );
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

    getDirectChatsForUser = async (address: string) => {
        return this.zkchat.getDirectChatsForUser(address);
    }

    searchChats = async (query: string, sender?: string, offset = 0, limit = 20) => {
        console.log(query, sender);
        const values = await this.sequelize.query(`
            SELECT 
              ecdh.value as receiver_ecdh,
              idcommitment.value as receiver_idcommitment,
              zku.wallet_address as receiver_address
            FROM zkchat_users zku
            LEFT JOIN profiles ecdh ON ecdh."messageId" = (SELECT "messageId" FROM profiles WHERE creator = zku.wallet_address AND subtype = 'CUSTOM' AND key='ecdh_pubkey' ORDER BY "createdAt" DESC LIMIT 1)
            LEFT JOIN profiles idcommitment ON idcommitment."messageId" = (SELECT "messageId" FROM profiles WHERE creator = zku.wallet_address AND subtype = 'CUSTOM' AND key='id_commitment' ORDER BY "createdAt" DESC LIMIT 1)
            LEFT JOIN profiles name ON name."messageId" = (SELECT "messageId" FROM profiles WHERE creator = zku.wallet_address AND subtype = 'NAME' ORDER BY "createdAt" DESC LIMIT 1)
            WHERE (
                LOWER(name.value) LIKE :query
                OR LOWER(name.creator) LIKE :query
                OR LOWER(name.creator) IN (SELECT LOWER(address) from ens WHERE LOWER(ens) LIKE :query)
                OR LOWER(name.creator) IN (SELECT LOWER(creator) from profiles WHERE subtype = 'NAME' AND LOWER(value) LIKE :query ORDER BY "createdAt" DESC LIMIT 1)
            )
            ${!sender ? '' : `
            AND (
                zku.wallet_address IN (SELECT distinct zk.receiver_address FROM zkchat_chats zk WHERE zk.sender_address = :sender)
                OR zku.wallet_address IN (SELECT distinct zk.sender_address FROM zkchat_chats zk WHERE zk.receiver_address = :sender)
            )`}
            
            LIMIT :limit OFFSET :offset
        `, {
            type: QueryTypes.SELECT,
            replacements: {
                query: `%${query.toLowerCase()}%`,
                sender,
                limit,
                offset,
            },
        });

        return values;
    }
}