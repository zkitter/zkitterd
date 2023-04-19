import { QueryTypes } from 'sequelize';
import { GenericService } from '@util/svc';
import { userSelectQuery } from '@models/users';
import DBService from '@services/db';

export default class ZKChatService extends GenericService {
  searchChats = async (query: string, sender?: string, offset = 0, limit = 20) => {
    const db = this.main?.services['db'] as DBService;
    return await db.sequelize.query(
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
