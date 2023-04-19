import { RLNFullProof, SemaphoreFullProof } from '@zk-kit/protocols';
import { Dialect, QueryTypes, Sequelize } from 'sequelize';

import { GenericService } from '@util/svc';
import { userSelectQuery } from '@models/users';

export default class ZKChatService extends GenericService {
  sequelize: Sequelize;

  constructor() {
    super();
  }

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
