import { Mutex } from 'async-mutex';
import { BIGINT, Op, QueryTypes, Sequelize, STRING } from 'sequelize';

import config from '@util/config';
import { MessageType, PostJSON, PostMessageSubType } from '@util/message';
import {
  globalModClause,
  globalVisibilityClause,
  notBlockedClause,
  replyModerationClause,
} from '@util/sql';

const mutex = new Mutex();

export type PostModel = {
  messageId: string;
  hash: string;
  proof?: string;
  signals?: string;
  creator: string;
  type: string;
  subtype: string;
  createdAt: number;
  topic: string;
  title: string;
  content: string;
  reference: string;
  attachment: string;
};

const posts = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'posts',
    {
      attachment: {
        type: STRING(4095),
      },
      content: {
        allowNull: false,
        type: STRING(65535),
      },
      createdAt: {
        allowNull: false,
        type: BIGINT,
      },
      creator: {
        allowNull: false,
        type: STRING,
      },
      hash: {
        allowNull: false,
        primaryKey: true,
        type: STRING,
      },
      messageId: {
        allowNull: false,
        type: STRING,
      },
      proof: {
        type: STRING(65535),
      },
      reference: {
        type: STRING,
      },
      signals: {
        type: STRING(65535),
      },
      subtype: {
        type: STRING,
      },
      title: {
        allowNull: false,
        type: STRING(4095),
      },
      topic: {
        allowNull: false,
        type: STRING,
      },
      type: {
        allowNull: false,
        type: STRING,
      },
    },
    {
      indexes: [
        { fields: ['creator'] },
        { fields: ['subtype'] },
        { fields: ['topic'] },
        { fields: ['reference'] },
        { fields: ['hash'], unique: true },
        { fields: ['messageId'], unique: true },
      ],
    }
  );

  const remove = async (hash: string) => {
    return model.destroy({
      where: {
        hash,
      },
    });
  };

  const findRoot = async (messageId: string): Promise<string | null> => {
    const result = await model.findOne({
      where: {
        messageId,
      },
    });

    if (result) {
      const json: PostModel = result.toJSON();
      if (json.reference && json.subtype === 'REPLY') {
        return findRoot(json.reference);
      }

      if (json.reference && json.subtype === 'M_REPLY') {
        return findRoot(json.reference);
      }

      if (json.reference && json.subtype === 'REPOST') {
        return findRoot(json.reference);
      }

      if (!json.reference) {
        return json.messageId;
      }
    }

    return null;
  };

  const getAll = async (): Promise<PostModel[]> => {
    const posts = await model.findAll<any>();
    return posts.map(data => data.toJSON());
  };

  const findOne = async (hash: string, context?: string): Promise<PostJSON | null> => {
    const result = await sequelize.query(
      `
            ${selectJoinQuery}
            WHERE (
                p.hash = :hash 
                AND p."createdAt" != -1 
                AND p."creator" NOT IN (SELECT name FROM connections WHERE name = p.creator AND creator = :context AND subtype = 'BLOCK')
            )
        `,
      {
        replacements: {
          context: context || '',
          hash,
        },
        type: QueryTypes.SELECT,
      }
    );

    const values: PostJSON[] = [];

    for (const r of result) {
      const post = inflateResultToPostJSON(r);
      if (post.createdAt > 0) {
        values.push(post);
      }
    }

    return values[0];
  };

  const findAllPosts = async (
    creator?: string,
    context?: string,
    offset = 0,
    limit = 20,
    order: 'DESC' | 'ASC' = 'DESC',
    showAll = false
  ): Promise<PostJSON[]> => {
    const result = await sequelize.query(
      `
            ${selectJoinQuery}
            WHERE (
                (p.type = 'POST' AND p.subtype IN ('', 'M_POST', 'REPOST')) 
                AND (p."createdAt" != -1${creator ? ' AND p.creator = :creator' : ''}) 
                AND (blk."messageId" IS NULL AND rpblk."messageId" IS NULL) 
                AND (p."creator" NOT IN (SELECT name FROM connections WHERE name = p.creator AND creator = :context AND subtype = 'BLOCK'))
                AND ${globalModClause}
                ${!showAll ? `AND ${globalVisibilityClause}` : ''}
            )
            ORDER BY p."createdAt" ${order}
            LIMIT :limit OFFSET :offset
        `,
      {
        replacements: {
          context: context || '',
          creator: creator || '',
          limit,
          offset,
        },
        type: QueryTypes.SELECT,
      }
    );

    const values: PostJSON[] = [];

    for (const r of result) {
      const post = inflateResultToPostJSON(r);
      values.push(post);
    }

    return values;
  };

  const findAllRepliesFromCreator = async (
    creator?: string,
    context?: string,
    offset = 0,
    limit = 20,
    order: 'DESC' | 'ASC' = 'DESC'
  ): Promise<PostJSON[]> => {
    const result = await sequelize.query(
      `
            ${selectJoinQuery}
            WHERE (
                p.type = 'POST' 
                AND p.subtype IN ('REPLY', 'M_REPLY') 
                AND p."createdAt" != -1${creator ? ' AND p.creator = :creator' : ''} 
                AND (blk."messageId" IS NULL AND rpblk."messageId" IS NULL) 
                AND p."creator" NOT IN (SELECT name FROM connections WHERE name = p.creator AND creator = :context AND subtype = 'BLOCK')
                AND ${globalModClause}
            )
            ORDER BY p."createdAt" ${order}
            LIMIT :limit OFFSET :offset
        `,
      {
        replacements: {
          context: context || '',
          creator: creator || '',
          limit,
          offset,
        },
        type: QueryTypes.SELECT,
      }
    );

    const values: PostJSON[] = [];

    for (const r of result) {
      const post = inflateResultToPostJSON(r);
      values.push(post);
    }

    return values;
  };

  const getHomeFeed = async (
    context?: string,
    offset = 0,
    limit = 20,
    order: 'DESC' | 'ASC' = 'DESC'
  ): Promise<PostJSON[]> => {
    const result = await sequelize.query(
      `
            ${selectJoinQuery}
            WHERE (
                p.subtype != 'REPLY' 
                AND p."createdAt" != -1 
                AND (
                    p.creator IN (SELECT name FROM connections WHERE subtype = 'FOLLOW' AND creator = :context) OR
                    p.creator = :context
                ) 
                AND ${notBlockedClause}
                AND ${globalModClause}
            )
            ORDER BY p."createdAt" ${order}
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

    const values: PostJSON[] = [];

    for (const r of result) {
      const post = inflateResultToPostJSON(r);
      values.push(post);
    }

    return values;
  };

  const findAllReplies = async (
    reference: string,
    context?: string,
    offset = 0,
    limit = 20,
    order: 'DESC' | 'ASC' = 'ASC',
    tweetId = '',
    unmoderated = false
  ): Promise<PostJSON[]> => {
    const result = await sequelize.query(
      `
            ${selectJoinQuery}
            WHERE (
                (
                    (p.subtype IN ('REPLY', 'M_REPLY') AND p."createdAt" != -1 AND p.reference = :reference) 
                    OR (p.type = '@TWEET@' AND p.reference = '${tweetId}')
                )
                ${unmoderated ? '' : `AND ${notBlockedClause}`}
                ${unmoderated ? '' : `AND ${replyModerationClause}`}
                AND ${globalModClause}
            )
            ORDER BY p."createdAt" ${order}
            LIMIT :limit OFFSET :offset
        `,
      {
        replacements: {
          context: context || '',
          limit,
          offset,
          reference,
        },
        type: QueryTypes.SELECT,
      }
    );

    const values: PostJSON[] = [];
    for (const r of result) {
      const post = inflateResultToPostJSON(r);
      values.push(post);
    }

    return values;
  };

  const findAllLikedPostsByCreator = async (
    creator: string,
    context?: string,
    offset = 0,
    limit = 20,
    order: 'DESC' | 'ASC' = 'DESC'
  ): Promise<PostJSON[]> => {
    const result = await sequelize.query(
      `
            ${selectLikedPostsQuery}
            WHERE (
                p."createdAt" != -1
                ${creator ? ' AND mod.creator = :creator' : ''} 
                AND mod.subtype = 'LIKE'
                AND (blk."messageId" IS NULL AND rpblk."messageId" IS NULL) 
                AND p."creator" NOT IN (SELECT name FROM connections WHERE name = p.creator AND creator = :context AND subtype = 'BLOCK')
                AND ${globalModClause}
            )
            ORDER BY p."createdAt" ${order}
            LIMIT :limit OFFSET :offset
        `,
      {
        replacements: {
          context: context || '',
          creator,
          limit,
          offset,
        },
        type: QueryTypes.SELECT,
      }
    );

    const values: PostJSON[] = [];
    for (const r of result) {
      const post = inflateResultToPostJSON(r);
      values.push(post);
    }

    return values;
  };

  const findAllRetweets = async (
    messageId: string,
    offset = 0,
    limit = 20,
    order: 'DESC' | 'ASC' = 'DESC'
  ) => {
    const result = await model.findAll({
      limit,
      offset,
      order: [['createdAt', order]],
      where: { reference: messageId, subtype: 'REPOST' },
    });

    return result.map((r: any) => r.toJSON().creator);
  };

  const findLastTweetInConversation = async (id: string) => {
    const result = await model.findOne({
      limit: 1,
      order: [['createdAt', 'DESC']],
      where: {
        [Op.or]: [
          {
            reference: id,
            type: '@TWEET@',
          },
        ],
      },
    });

    return result?.toJSON();
  };

  const createTwitterPosts = async (records: PostModel[]) => {
    return mutex.runExclusive(async () => {
      for (const record of records) {
        if (record.type !== '@TWEET@') continue;

        const topic = `https://twitter.com/${record.creator}/status/${record.messageId}`;
        const result = await model.findOne({
          where: {
            [Op.or]: [
              {
                subtype: [PostMessageSubType.MirrorPost, PostMessageSubType.MirrorReply],
                topic: topic,
              },
              {
                messageId: record.messageId,
                type: '@TWEET@',
              },
            ],
          },
        });

        if (result) {
          continue;
        }

        await model.create(record);
      }
    });
  };

  const createPost = async (record: PostModel) => {
    return mutex.runExclusive(async () => {
      const result = await model.findOne({
        where: {
          hash: record.hash,
        },
      });

      if (result) {
        const json = (await result.toJSON()) as PostModel;
        if (json.createdAt < 0) {
          // @ts-expect-error
          await result.changed('createdAt', true);
          await result.set('createdAt', record.createdAt, { raw: true });
          await result.save({
            fields: ['createdAt'],
          });
          return result.update(record);
        }
      }

      return model.create(record);
    });
  };

  const ensurePost = async (messageId: string) => {
    return mutex.runExclusive(async () => {
      const [creator, hash] = messageId.split('/');
      const result = await model.findOne({
        where: {
          hash: hash || creator,
        },
      });

      if (!result) {
        const emptyModel: PostModel = {
          attachment: '',
          content: '',
          createdAt: -1,
          creator: hash ? creator : '',
          hash: hash || creator,
          messageId: messageId,
          reference: '',
          subtype: PostMessageSubType.Default,
          title: '',
          topic: '',
          type: MessageType.Post,
        };
        return model.create(emptyModel);
      }
    });
  };

  const vectorizeContent = async () => {
    // add tsvector column
    await sequelize.query(
      `
          ALTER TABLE posts
              ADD COLUMN ts tsvector
                  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
      `
    );

    // create Generalized Inverted Index (https://www.postgresql.org/docs/current/textsearch-indexes.html)
    await sequelize.query(`CREATE INDEX ts_idx ON posts USING GIN (ts)`);
  };

  const search = async (query: string, offset = 0, limit = 20, order: 'DESC' | 'ASC' = 'DESC') =>
    sequelize
      // prettier-ignore
      .query(
        `SELECT *
         FROM posts
         WHERE ts @@ to_tsquery('english', :query)
         ORDER BY "createdAt" ${order} LIMIT :limit
         OFFSET :offset`,
        {
          replacements: {
            limit,
            offset,
            query: query.replace(/\||,/g, ' ').replace(/\s\s+/g, ' ').replace(/ /g, ' | '),
          },
          type: QueryTypes.SELECT,
        }
      )
      .then(result => result.map(inflateResultToPostJSON));

  return {
    createPost,
    createTwitterPosts,
    ensurePost,
    findAllLikedPostsByCreator,
    findAllPosts,
    findAllReplies,
    findAllRepliesFromCreator,
    findAllRetweets,
    findLastTweetInConversation,
    findOne,
    findRoot,
    getHomeFeed,
    model,
    remove,
    search,
    vectorizeContent,
    getAll,
  };
};

export function inflateResultToPostJSON(r: any): PostJSON {
  const json = r as any;
  const meta = {
    blocked: json?.blocked,
    interepGroup: json?.interepGroup,
    interepProvider: json?.interepProvider,
    likeCount: +json?.likeCount || 0,
    liked: json?.liked,
    global: json?.global || null,
    modblockedctx: json?.modblockedctx || null,
    modBlockedPost: json?.modBlockedPost || null,
    modBlockedUser: json?.modBlockedUser || null,
    moderation: json?.moderation || null,
    modfollowedctx: json?.modfollowedctx || null,
    modFollowerUser: json?.modFollowerUser || null,
    modLikedPost: json?.modLikedPost || null,
    modmentionedctx: json?.modmentionedctx || null,
    replyCount: +json?.replyCount || 0,
    repostCount: +json?.repostCount || 0,
    reposted: json?.reposted,
    rootId: json?.rootId,
  };

  if (json.subtype === PostMessageSubType.Repost) {
    meta.replyCount = +json?.rpReplyCount || 0;
    meta.likeCount = +json?.rpLikeCount || 0;
    meta.repostCount = +json?.rpRepostCount || 0;
    meta.liked = json?.rpLiked || null;
    meta.blocked = json?.rpBLocked || null;
    meta.reposted = json?.rpReposted || null;
    meta.interepProvider = json?.rpInterepProvider || null;
    meta.interepGroup = json?.rpInterepGroup || null;
  }

  return {
    createdAt: json.createdAt,
    hash: json.hash,
    messageId: json.creator ? `${json.creator}/${json.hash}` : json.hash,
    meta: meta,
    payload: {
      attachment: json.attachment,
      content: json.content,
      reference: json.reference,
      title: json.title,
      topic: json.topic,
    },
    subtype: json.subtype as PostMessageSubType,
    type: json.type as MessageType,
  };
}

export default posts;

const selectJoinQuery = `
    SELECT p.hash,
           p.creator,
           p.type,
           p.subtype,
           p."createdAt",
           p.topic,
           p.title,
           p.content,
           p.reference,
           p.attachment,
           m."messageId"                as liked,
           rpm."messageId"              as "rpLiked",
           thrdmod."subtype"            as "moderation",
           global."messageId"           as "global",
           root."messageId"             as "rootId",
           modliked."messageId"         as "modLikedPost",
           modblocked."messageId"       as "modBlockedPost",
           modblockeduser."messageId"   as "modBlockedUser",
           modfolloweduser."messageId"  as "modFollowerUser",
           modblockedctx."messageId"    as "modblockedctx",
           modfollowedctx."messageId"   as "modfollowedctx",
           modmentionedctx."message_id" as "modmentionedctx",
           blk."messageId"              as blocked,
           rpblk."messageId"            as "rpBlocked",
           rp."messageId"               as reposted,
           rprp."messageId"             as "rpReposted",
           mt."replyCount",
           mt."repostCount",
           mt."likeCount",
           rpmt."replyCount"            as "rpReplyCount",
           rpmt."repostCount"           as "rpRepostCount",
           rpmt."likeCount"             as "rpLikeCount",
           rpsc.provider                as "rpInterepProvider",
           rpsc."group"                 as "rpInterepGroup",
           sc.provider                  as "interepProvider",
           sc."group"                   as "interepGroup"
    FROM posts p
             LEFT JOIN moderations m ON m."messageId" = (SELECT "messageId"
                                                         FROM moderations
                                                         WHERE subtype = 'LIKE'
                                                           AND reference = p."messageId"
                                                           AND creator = :context LIMIT 1)
        LEFT JOIN moderations rpm
    ON rpm."messageId" = (select "messageId" from moderations where subtype = 'LIKE' AND reference = p.reference AND creator = :context AND p.subtype = 'REPOST' LIMIT 1)
        LEFT JOIN moderations blk ON blk."messageId" = (SELECT "messageId" FROM moderations WHERE subtype = 'BLOCK' AND reference = p."messageId" AND creator = :context LIMIT 1)
        LEFT JOIN moderations rpblk ON rpblk."messageId" = (select "messageId" from moderations where subtype = 'BLOCK' AND reference = p.reference AND creator = :context AND p.subtype = 'REPOST' LIMIT 1)
        LEFT JOIN threads thrd ON thrd."message_id" = p."messageId"
        LEFT JOIN posts root ON thrd.root_id = root."messageId"
        LEFT JOIN moderations thrdmod ON thrdmod."messageId" = (select "messageId" from moderations where creator = root.creator AND subtype IN ('THREAD_HIDE_BLOCK', 'THREAD_SHOW_FOLLOW', 'THREAD_ONLY_MENTION') AND reference = root."messageId" LIMIT 1)
        LEFT JOIN moderations global ON global."messageId" = (select "messageId" from moderations where creator = p.creator AND subtype IN ('GLOBAL') AND reference = p."messageId" LIMIT 1)
        LEFT JOIN moderations modliked ON modliked."messageId" = (SELECT "messageId" FROM moderations WHERE subtype = 'LIKE' AND reference = p."messageId" AND creator = root.creator LIMIT 1)
        LEFT JOIN moderations modblocked ON modblocked."messageId" = (SELECT "messageId" FROM moderations WHERE subtype = 'BLOCK' AND reference = p."messageId" AND creator = root.creator LIMIT 1)
        LEFT JOIN connections modblockeduser ON modblockeduser."messageId" = (SELECT "messageId" FROM connections WHERE subtype = 'BLOCK' AND name = p."creator" AND creator = root.creator LIMIT 1)
        LEFT JOIN connections modfolloweduser ON modfolloweduser."messageId" = (SELECT "messageId" FROM connections WHERE subtype = 'FOLLOW' AND name = p."creator" AND creator = root.creator LIMIT 1)
        LEFT JOIN moderations gmodblocked ON gmodblocked."messageId" = (SELECT "messageId" FROM moderations WHERE subtype = 'BLOCK' AND reference = p."messageId" AND creator IN (${config.moderators
          .map(d => `'${d}'`)
          .join(',')}) LIMIT 1)
        LEFT JOIN connections gmodblockeduser ON gmodblockeduser."messageId" = (SELECT "messageId" FROM connections WHERE subtype = 'BLOCK' AND name = p."creator" AND creator IN (${config.moderators
          .map(d => `'${d}'`)
          .join(',')}) LIMIT 1)
        LEFT JOIN posts rp ON rp."messageId" = (SELECT "messageId" from posts WHERE p."messageId" = reference AND creator = :context AND subtype = 'REPOST' LIMIT 1)
        LEFT JOIN posts rprp ON rprp."messageId" = (SELECT "messageId" from posts WHERE reference = p.reference AND creator = :context AND subtype = 'REPOST' AND p.subtype = 'REPOST' LIMIT 1)
        LEFT JOIN meta mt ON mt."reference" = p."messageId"
        LEFT JOIN meta rpmt ON p.subtype = 'REPOST' AND rpmt."reference" = p.reference
        LEFT JOIN semaphore_creators sc on sc."message_id" = p."messageId"
        LEFT JOIN semaphore_creators rpsc on p.subtype = 'REPOST' AND rpsc."message_id" = p."reference"
        LEFT JOIN connections modblockedctx ON modblockeduser."messageId" = (SELECT "messageId" FROM connections WHERE subtype = 'BLOCK' AND name = :context AND creator = root.creator LIMIT 1)
        LEFT JOIN connections modfollowedctx ON modfollowedctx."messageId" = (SELECT "messageId" FROM connections WHERE subtype = 'FOLLOW' AND name = :context AND creator = root.creator LIMIT 1)
        LEFT JOIN tags modmentionedctx ON modmentionedctx.message_id = root."messageId" AND modmentionedctx.tag_name = CONCAT('@',:context)
`;

const selectLikedPostsQuery = `
    SELECT p.hash,
           p.creator,
           p.type,
           p.subtype,
           p."createdAt",
           p.topic,
           p.title,
           p.content,
           p.reference,
           p.attachment,
           m."messageId"                as liked,
           rpm."messageId"              as "rpLiked",
           blk."messageId"              as blocked,
           rpblk."messageId"            as "rpBlocked",
           rp."messageId"               as reposted,
           rprp."messageId"             as "rpReposted",
           thrdmod.subtype              as "moderation",
           global."messageId"           as "global",
           root."messageId"             as "rootId",
           modliked."messageId"         as "modLikedPost",
           modblocked."messageId"       as "modBlockedPost",
           modblockeduser."messageId"   as "modBlockedUser",
           modfolloweduser."messageId"  as "modFollowerUser",
           modblockedctx."messageId"    as "modblockedctx",
           modfollowedctx."messageId"   as "modfollowedctx",
           modmentionedctx."message_id" as "modmentionedctx",
           mt."replyCount",
           mt."repostCount",
           mt."likeCount",
           rpmt."replyCount"            as "rpReplyCount",
           rpmt."repostCount"           as "rpRepostCount",
           rpmt."likeCount"             as "rpLikeCount",
           rpsc.provider                as "rpInterepProvider",
           rpsc."group"                 as "rpInterepGroup",
           sc.provider                  as "interepProvider",
           sc."group"                   as "interepGroup"
    FROM moderations mod
             LEFT JOIN posts p ON p."messageId" = mod.reference
             LEFT JOIN moderations m ON m."messageId" = (SELECT "messageId"
                                                         FROM moderations
                                                         WHERE subtype = 'LIKE'
                                                           AND reference = p."messageId"
                                                           AND creator = :context LIMIT 1)
        LEFT JOIN moderations rpm
    ON rpm."messageId" = (select "messageId" from moderations where subtype = 'LIKE' AND reference = p.reference AND creator = :context AND p.subtype = 'REPOST' LIMIT 1)
        LEFT JOIN moderations blk ON blk."messageId" = (SELECT "messageId" FROM moderations WHERE subtype = 'BLOCK' AND reference = p."messageId" AND creator = :context LIMIT 1)
        LEFT JOIN moderations rpblk ON rpblk."messageId" = (select "messageId" from moderations where subtype = 'BLOCK' AND reference = p.reference AND creator = :context AND p.subtype = 'REPOST' LIMIT 1)
        LEFT JOIN threads thrd ON thrd."message_id" = p."messageId"
        LEFT JOIN posts root ON thrd.root_id = root."messageId"
        LEFT JOIN moderations thrdmod ON thrdmod."messageId" = (select "messageId" from moderations where creator = root.creator AND subtype IN ('THREAD_HIDE_BLOCK', 'THREAD_SHOW_FOLLOW', 'THREAD_ONLY_MENTION') AND reference = root."messageId" LIMIT 1)
        LEFT JOIN moderations global ON global."messageId" = (select "messageId" from moderations where creator = p.creator AND subtype IN ('GLOBAL') AND reference = p."messageId" LIMIT 1)
        LEFT JOIN moderations modliked ON modliked."messageId" = (SELECT "messageId" FROM moderations WHERE subtype = 'LIKE' AND reference = p."messageId" AND creator = root.creator LIMIT 1)
        LEFT JOIN moderations modblocked ON modblocked."messageId" = (SELECT "messageId" FROM moderations WHERE subtype = 'BLOCK' AND reference = p."messageId" AND creator = root.creator LIMIT 1)
        LEFT JOIN connections modblockeduser ON modblockeduser."messageId" = (SELECT "messageId" FROM connections WHERE subtype = 'BLOCK' AND name = p."creator" AND creator = root.creator LIMIT 1)
        LEFT JOIN moderations gmodblocked ON gmodblocked."messageId" = (SELECT "messageId" FROM moderations WHERE subtype = 'BLOCK' AND reference = p."messageId" AND creator IN (${config.moderators
          .map(d => `'${d}'`)
          .join(',')}) LIMIT 1)
        LEFT JOIN connections gmodblockeduser ON gmodblockeduser."messageId" = (SELECT "messageId" FROM connections WHERE subtype = 'BLOCK' AND name = p."creator" AND creator IN (${config.moderators
          .map(d => `'${d}'`)
          .join(',')}) LIMIT 1)
        LEFT JOIN connections modfolloweduser ON modfolloweduser."messageId" = (SELECT "messageId" FROM connections WHERE subtype = 'FOLLOW' AND name = p."creator" AND creator = root.creator LIMIT 1)
        LEFT JOIN posts rp ON rp."messageId" = (SELECT "messageId" from posts WHERE p."messageId" = reference AND creator = :context AND subtype = 'REPOST' LIMIT 1)
        LEFT JOIN posts rprp ON rprp."messageId" = (SELECT "messageId" from posts WHERE reference = p.reference AND creator = :context AND subtype = 'REPOST' AND p.subtype = 'REPOST' LIMIT 1)
        LEFT JOIN meta mt ON mt."reference" = p."messageId"
        LEFT JOIN meta rpmt ON p.subtype = 'REPOST' AND rpmt."reference" = p.reference
        LEFT JOIN semaphore_creators sc on sc."message_id" = mod.reference
        LEFT JOIN semaphore_creators rpsc on p.subtype = 'REPOST' AND rpsc."message_id" = p."reference"
        LEFT JOIN connections modblockedctx ON modblockeduser."messageId" = (SELECT "messageId" FROM connections WHERE subtype = 'BLOCK' AND name = :context AND creator = root.creator LIMIT 1)
        LEFT JOIN connections modfollowedctx ON modfollowedctx."messageId" = (SELECT "messageId" FROM connections WHERE subtype = 'FOLLOW' AND name = :context AND creator = root.creator LIMIT 1)
        LEFT JOIN tags modmentionedctx ON modmentionedctx.message_id = root."messageId" AND modmentionedctx.tag_name = CONCAT('@',:context)
`;
