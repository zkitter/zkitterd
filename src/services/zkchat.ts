/* eslint-disable import/no-unresolved */
import { RLNFullProof, SemaphoreFullProof } from '@zk-kit/protocols';
import { Dialect, QueryTypes, Sequelize } from 'sequelize';

import { GenericService } from '@util/svc';
// @ts-expect-error
import { ZKChat } from '~/zk-chat-server/src';
// @ts-expect-error
import { ChatMessage } from '~/zk-chat-server/src/services/chat.service';
// @ts-expect-error
import config from '~/zk-chat-server/src/utils/config';
import { userSelectQuery } from '@models/users';

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
        dialect: config.DB_DIALECT as Dialect,
        host: config.DB_HOST,
        logging: false,
        port: Number(config.DB_PORT),
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

  getUnreadCountDM = async (sender_pubkey: string, receiverPubkey: string, lastRead = 0) => {
    return this.zkchat.getUnreadCountDM(sender_pubkey, receiverPubkey, lastRead);
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
    return await this.sequelize.query(
      `
            ${userSelectQuery}
            WHERE ecdh.value != '' AND (
                LOWER(u."name") LIKE :query 
                OR LOWER(u."name") IN (SELECT LOWER(address) from ens WHERE LOWER(ens) LIKE :query)
                OR LOWER(u."name") IN (SELECT LOWER(creator) from profiles WHERE subtype = 'NAME' AND LOWER(value) LIKE :query)
            )
            LIMIT :limit OFFSET :offset
        `,
      {
        replacements: {
          context: sender || '',
          limit,
          offset,
          query: `%${query.toLowerCase()}%`,
        },
        type: QueryTypes.SELECT,
      }
    );
  };
}
