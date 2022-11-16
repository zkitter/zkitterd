import { GenericService } from '@util/svc';
import { ZKChat } from '~/zk-chat-server/src';
import { ChatMessage } from '~/zk-chat-server/src/services/chat.service';
import { Dialect, QueryTypes, Sequelize } from 'sequelize';
import config from '~/zk-chat-server/src/utils/config';
import { RLNFullProof, SemaphoreFullProof } from '@zk-kit/protocols';

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
      }
    );
  }

  start = async () => {
    return this.zkchat.init();
  };

  registerUser = async (address: string, ecdhPubkey: string) => {
    return this.zkchat.registerUser(address, ecdhPubkey);
  };

  getAllUsers = async (offset = 0, limit = 20) => {
    return this.zkchat.getAllUsers(offset, limit);
  };

  addChatMessage = async (chatMessage: ChatMessage) => {
    return this.zkchat.addChatMessage(chatMessage);
  };

  getDirectMessages = async (
    senderPubkey: string,
    receiverPubkey: string,
    offset = 0,
    limit = 20
  ) => {
    return this.zkchat.getDirectMessages(senderPubkey, receiverPubkey, offset, limit);
  };

  getDirectChatsForUser = async (pubkey: string) => {
    return this.zkchat.getDirectChatsForUser(pubkey);
  };

  isEpochCurrent = async (epoch: string) => {
    return this.zkchat.isEpochCurrent(epoch);
  };

  verifyRLNProof = async (proof: RLNFullProof) => {
    return this.zkchat.verifyRLNProof(proof);
  };

  verifySemaphoreProof = async (proof: SemaphoreFullProof) => {
    return this.zkchat.verifySemaphoreProof(proof);
  };

  checkShare = async (share: {
    nullifier: string;
    epoch: string;
    x_share: string;
    y_share: string;
  }) => {
    return this.zkchat.checkShare(share);
  };

  insertShare = async (share: {
    nullifier: string;
    epoch: string;
    x_share: string;
    y_share: string;
  }) => {
    return this.zkchat.insertShare(share);
  };

  searchChats = async (query: string, sender?: string, offset = 0, limit = 20) => {
    const values = await this.sequelize.query(
      `
            SELECT 
              ecdh.value as receiver_ecdh,
              idcommitment.value as receiver_idcommitment,
              zku.wallet_address as receiver_address
            FROM zkchat_users zku
            LEFT JOIN profiles ecdh ON ecdh."messageId" = (SELECT "messageId" FROM profiles WHERE creator = zku.wallet_address AND subtype = 'CUSTOM' AND key='ecdh_pubkey' ORDER BY "createdAt" DESC LIMIT 1)
            LEFT JOIN profiles idcommitment ON idcommitment."messageId" = (SELECT "messageId" FROM profiles WHERE creator = zku.wallet_address AND subtype = 'CUSTOM' AND key='id_commitment' ORDER BY "createdAt" DESC LIMIT 1)
            LEFT JOIN profiles name ON name."messageId" = (SELECT "messageId" FROM profiles WHERE creator = zku.wallet_address AND subtype = 'NAME' ORDER BY "createdAt" DESC LIMIT 1)
            WHERE (
                LOWER(zku.wallet_address) LIKE :query
                OR LOWER(name.value) LIKE :query
                OR LOWER(name.creator) LIKE :query
                OR LOWER(name.creator) IN (SELECT LOWER(address) from ens WHERE LOWER(ens) LIKE :query)
                OR LOWER(name.creator) IN (SELECT LOWER(creator) from profiles WHERE subtype = 'NAME' AND LOWER(value) LIKE :query ORDER BY "createdAt" DESC LIMIT 1)
            )
            ${
              !sender
                ? ''
                : `
            AND (
                zku.wallet_address IN (SELECT distinct zk.receiver_address FROM zkchat_chats zk WHERE zk.sender_address = :sender)
                OR zku.wallet_address IN (SELECT distinct zk.sender_address FROM zkchat_chats zk WHERE zk.receiver_address = :sender)
            )`
            }
            
            LIMIT :limit OFFSET :offset
        `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          query: `%${query.toLowerCase()}%`,
          sender,
          limit,
          offset,
        },
      }
    );

    return values;
  };
}
