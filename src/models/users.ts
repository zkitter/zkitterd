import { Mutex } from 'async-mutex';
import { BIGINT, ENUM, QueryTypes, Sequelize, STRING } from 'sequelize';

export type UserModel = {
  username: string;
  type: 'ens' | 'arbitrum' | '';
  pubkey: string;
  joinedAt: number;
  joinedTx: string;
  name: string;
  bio: string;
  coverImage: string;
  profileImage: string;
  website: string;
  twitterVerification: string;
  group: boolean;
  idcommitment: string;
  ecdh: string;
  meta: {
    inviteSent: string | null;
    acceptanceReceived: string | null;
    inviteReceived: string | null;
    acceptanceSent: string | null;
    blockedCount: number;
    blockingCount: number;
    followerCount: number;
    followingCount: number;
    postingCount: number;
    mentionedCount: number;
    followed: string | null;
    blocked: string | null;
  };
};

const mutex = new Mutex();

const users = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'users',
    {
      joinedAt: {
        type: BIGINT,
      },
      name: {
        allowNull: false,
        primaryKey: true,
        type: STRING,
        unique: true,
        validate: {
          notEmpty: true,
        },
      },
      pubkey: {
        allowNull: false,
        type: STRING,
      },
      tx: {
        allowNull: false,
        type: STRING,
      },
      type: {
        allowNull: false,
        type: ENUM('arbitrum', 'ens', ''),
      },
    },
    {
      indexes: [
        { fields: ['name'] },
        { fields: ['pubkey'] },
        { fields: ['type'] },
        { fields: ['tx'] },
      ],
    }
  );

  const findOneByName = async (name: string, context = ''): Promise<UserModel | null> => {
    const values = await sequelize.query(
      `
            ${userSelectQuery}
            WHERE u.name = :name
        `,
      {
        replacements: {
          context: context || '',
          name: name,
        },
        type: QueryTypes.SELECT,
      }
    );

    const [user] = inflateValuesToUserJSON(values);

    return user || null;
  };

  const findOneByPubkey = async (pubkey: string): Promise<UserModel | null> => {
    const result = await model.findOne({
      where: {
        pubkey,
      },
    });

    if (!result) return null;

    const json = result.toJSON() as UserModel;

    return json;
  };

  const readAll = async (context = '', offset = 0, limit = 20): Promise<UserModel[]> => {
    const values = await sequelize.query(
      `
            ${userSelectQuery}
            ORDER BY (umt."followerCount"+umt."postingCount"+umt."mentionedCount") ASC
            LIMIT :limit OFFSET :offset
        `,
      {
        replacements: {
          context: context || '',
          limit,
          offset,
        },
        type: QueryTypes.SELECT,
      }
    );

    return inflateValuesToUserJSON(values);
  };

  const search = async (
    query: string,
    context = '',
    offset = 0,
    limit = 5
  ): Promise<UserModel[]> => {
    const values = await sequelize.query(
      `
            ${userSelectQuery}
            WHERE (
                LOWER(u."name") LIKE :query 
                OR LOWER(u."name") IN (SELECT LOWER(address) from ens WHERE LOWER(ens) LIKE :query)
                OR LOWER(u."name") IN (SELECT LOWER(creator) from profiles WHERE subtype = 'NAME' AND LOWER(value) LIKE :query)
            )
            LIMIT :limit OFFSET :offset
        `,
      {
        replacements: {
          context: context || '',
          limit,
          offset,
          query: `%${query.toLowerCase()}%`,
        },
        type: QueryTypes.SELECT,
      }
    );

    return inflateValuesToUserJSON(values);
  };

  const updateOrCreateUser = async (user: {
    name: string;
    pubkey: string;
    joinedAt: number;
    tx: string;
    type: 'ens' | 'arbitrum';
  }) => {
    return mutex.runExclusive(async () => {
      const result = await model.findOne({
        where: {
          name: user.name,
        },
      });

      if (result) {
        const json = result.toJSON() as UserModel;
        if (user.joinedAt > Number(json.joinedAt)) {
          return result.update(user);
        }
        return;
      }

      return model.create(user);
    });
  };

  const ensureUser = async (name: string) => {
    return mutex.runExclusive(async () => {
      const result = await model.findOne({
        where: {
          name: name,
        },
      });

      if (!result) {
        return model.create({
          joined: 0,
          name,
          pubkey: '',
          tx: '',
          type: '',
        });
      }
    });
  };

  return {
    ensureUser,
    findOneByName,
    findOneByPubkey,
    model,
    readAll,
    search,
    updateOrCreateUser,
  };
};

export default users;

const userSelectQuery = `
  SELECT  
    u.name,
    u.pubkey,
    u."joinedAt",
    u."tx",
    u."type",
    umt."followerCount",
    umt."followingCount",
    umt."blockedCount",
    umt."blockingCount",
    umt."postingCount",
    umt."mentionedCount",
    f."messageId" as followed,
    b."messageId" as blocked,
    bio.value as bio,
    name.value as nickname,
    "profileImage".value as "profileImage",
    "coverImage".value as "coverImage",
    "group".value as "group",
    "twitterVerification".value as "tweetId",
    "twitterVerification".key as "twitterHandle",
    website.value as website,
    ecdh.value as ecdh,
    idcommitment.value as idcommitment,
    accept."messageId" as accepted,
    invite."messageId" as invited,
    invrecv."messageId" as invrecv,
    acceptsent."messageId" as acceptsent
  FROM users u
  LEFT JOIN usermeta umt ON umt.name = u.name
  LEFT JOIN connections f ON f."messageId" = (SELECT "messageId" FROM connections conn WHERE conn.subtype = 'FOLLOW' AND conn.creator = :context AND conn.name = u.name ORDER BY "createdAt" DESC LIMIT 1)
  LEFT JOIN connections b ON b."messageId" = (SELECT "messageId" FROM connections conn WHERE conn.subtype = 'BLOCK' AND conn.creator = :context AND conn.name = u.name ORDER BY "createdAt" DESC LIMIT 1)
  LEFT JOIN profiles bio ON bio."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'BIO' ORDER BY "createdAt" DESC LIMIT 1)
  LEFT JOIN profiles name ON name."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'NAME' ORDER BY "createdAt" DESC LIMIT 1)
  LEFT JOIN profiles "profileImage" ON "profileImage"."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'PROFILE_IMAGE' ORDER BY "createdAt" DESC LIMIT 1)
  LEFT JOIN profiles "coverImage" ON "coverImage"."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'COVER_IMAGE' ORDER BY "createdAt" DESC LIMIT 1)
  LEFT JOIN profiles "twitterVerification" ON "twitterVerification"."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'TWT_VERIFICATION' ORDER BY "createdAt" DESC LIMIT 1)
  LEFT JOIN profiles "group" ON "group"."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'GROUP' ORDER BY "createdAt" DESC LIMIT 1)
  LEFT JOIN profiles website ON website."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'WEBSITE' ORDER BY "createdAt" DESC LIMIT 1)
  LEFT JOIN profiles ecdh ON ecdh."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'CUSTOM' AND key='ecdh_pubkey' ORDER BY "createdAt" DESC LIMIT 1)
  LEFT JOIN profiles idcommitment ON idcommitment."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'CUSTOM' AND key='id_commitment' ORDER BY "createdAt" DESC LIMIT 1)
  LEFT JOIN connections invite ON invite."messageId" = (SELECT "messageId" FROM connections conn WHERE conn.subtype = 'MEMBER_INVITE' AND conn.creator = :context AND conn.name = u.name ORDER BY "createdAt" DESC LIMIT 1)
  LEFT JOIN connections invrecv ON invrecv."messageId" = (SELECT "messageId" FROM connections conn WHERE conn.subtype = 'MEMBER_INVITE' AND conn.creator = u.name AND conn.name = :context ORDER BY "createdAt" DESC LIMIT 1)
  LEFT JOIN connections accept ON accept."messageId" = (SELECT "messageId" FROM connections conn WHERE conn.subtype = 'MEMBER_ACCEPT' AND conn.creator = u.name AND conn.name = :context ORDER BY "createdAt" DESC LIMIT 1)
  LEFT JOIN connections acceptsent ON acceptsent."messageId" = (SELECT "messageId" FROM connections conn WHERE conn.subtype = 'MEMBER_ACCEPT' AND conn.creator = :context  AND conn.name = u.name ORDER BY "createdAt" DESC LIMIT 1)
`;

function inflateValuesToUserJSON(values: any[]): UserModel[] {
  return values.map(value => {
    let twitterVerification = '';

    if (value.tweetId && value.twitterHandle) {
      twitterVerification = `https://twitter.com/${value.twitterHandle}/status/${value.tweetId}`;
    }

    return {
      address: value.name,
      bio: value.bio || '',
      coverImage: value.coverImage || '',
      ecdh: value.ecdh || '',
      group: !!value.group,
      idcommitment: value.idcommitment || '',
      joinedAt: Number(value.joinedAt),
      joinedTx: value.tx,
      meta: {
        acceptanceReceived: value.accepted || null,
        acceptanceSent: value.acceptsent || null,
        blocked: value.blocked,
        blockedCount: value.blockedCount ? Number(value.blockedCount) : 0,
        blockingCount: value.blockingCount ? Number(value.blockingCount) : 0,
        followed: value.followed,
        followerCount: value.followerCount ? Number(value.followerCount) : 0,
        followingCount: value.followingCount ? Number(value.followingCount) : 0,
        inviteReceived: value.invrecv || null,
        inviteSent: value.invited || null,
        mentionedCount: value.mentionedCount ? Number(value.mentionedCount) : 0,
        postingCount: value.postingCount ? Number(value.postingCount) : 0,
      },
      name: value.nickname || '',
      profileImage: value.profileImage || '',
      pubkey: value.pubkey,
      twitterVerification: twitterVerification,
      type: value.type,
      username: value.name,
      website: value.website || '',
    };
  });
}
