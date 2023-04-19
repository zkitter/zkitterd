import { Request, Response } from 'express';
import { QueryTypes } from 'sequelize';
import Web3 from 'web3';

import { sequelize } from '@util/sequelize';
import { makeResponse } from '../utils';
import { Controller } from './interface';

export class UsersController extends Controller {
  prefix = '/v1';

  constructor() {
    super();
    this.addRoutes();
  }

  addRoutes = () => {
    this._router.route('/users').get(this.getMany).post(this.addOne);
    this._router.get('/users/:address', this.getOne);
    this._router.get('/ecdh/:ecdh', this.findUserByECDH);
    this._router.get('/:user/followers', this.getFollowers);
    this._router.get('/:user/followings', this.getFollowings);
    this._router.get('/:creator/replies', this.getReplies);
    this._router.get('/:creator/likes', this.getLikes);
    this._router.get('/:address/groups', this.getGroups);
    this._router.get('/:address/notifications', this.getNotifications);
    this._router.get('/:address/notifications/unread', this.getUnreadNotificationCounts);
    this._router.get('/users/search/:query?', this.search);
  };

  getMany = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const context = req.header('x-contextual-name') || undefined;
    const usersDB = await this.call('db', 'getUsers');
    const users = await usersDB.readAll(context, offset, limit);

    const result = [];

    for (const user of users) {
      const ens = await this.call('ens', 'fetchNameByAddress', user.username);
      result.push({ ens, ...user });
    }

    res.send(makeResponse(result));
  };

  addOne = async (req: Request, res: Response) => {
    const { account, proof, publicKey } = req.body;

    if (!account || !Web3.utils.isAddress(account)) {
      res.status(400).send(makeResponse('invalid account'));
      return;
    }

    if (!publicKey) {
      res.status(400).send(makeResponse('invalid publicKey'));
      return;
    }

    if (!proof) {
      res.status(400).send(makeResponse('invalid proof'));
      return;
    }

    const pubkeyBytes = Web3.utils.utf8ToHex(publicKey);
    const nonce = await this.call('arbitrum', 'getNonce', account);
    const hash = Web3.utils.keccak256(Web3.utils.encodePacked(account, pubkeyBytes, nonce)!);
    const recover = await this.call('ens', 'ecrecover', hash, proof);

    if (recover !== account) {
      throw new Error('invalid signature');
    }

    const tx = await this.call('arbitrum', 'updateFor', account, publicKey, proof);

    res.send(makeResponse(tx));
  };

  getOne = async (req: Request, res: Response) => {
    const usersDB = await this.call('db', 'getUsers');

    let address = req.params.address;

    try {
      address = Web3.utils.toChecksumAddress(address);
    } catch (e) {}

    if (!Web3.utils.isAddress(address)) {
      address = await this.call('ens', 'fetchAddressByName', address);
    }

    const context = req.header('x-contextual-name') || undefined;
    const user = await usersDB.findOneByName(address, context);
    const ens = await this.call('ens', 'fetchNameByAddress', address);
    res.send(
      makeResponse({
        ...user,
        address: address,
        ens: ens,
        username: address,
      })
    );
  };

  findUserByECDH = async (req: Request, res: Response) => {
    const profilesDB = await this.call('db', 'getProfiles');

    const ecdh = req.params.ecdh;

    const userAddress = await profilesDB.findUserByECDH(ecdh);
    res.send(makeResponse(userAddress));
  };

  getFollowers = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const user = req.params.user;
    const connectionsDB = await this.call('db', 'getConnections');
    const followers = await connectionsDB.findAllFollowersByName(user, offset, limit);
    res.send(makeResponse(followers));
  };

  getFollowings = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const user = req.params.user;
    const connectionsDB = await this.call('db', 'getConnections');
    const followings = await connectionsDB.findAllFollowingsByCreator(user, offset, limit);
    res.send(makeResponse(followings));
  };

  getReplies = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const creator = req.params.creator;
    const context = req.header('x-contextual-name') || undefined;
    const postDB = await this.call('db', 'getPosts');
    const posts = await postDB.findAllRepliesFromCreator(creator, context, offset, limit);
    res.send(makeResponse(posts));
  };

  getLikes = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const creator = req.params.creator;
    const context = req.header('x-contextual-name') || undefined;
    const postDB = await this.call('db', 'getPosts');
    const posts = await postDB.findAllLikedPostsByCreator(creator, context, offset, limit);
    res.send(makeResponse(posts));
  };

  getGroups = async (req: Request, res: Response) => {
    const { address } = req.params;
    const values = await sequelize.query(
      `
          SELECT u.name             as address,
                 name.value         as name,
                 idcommitment.value as idcommitment
          FROM users u
                   LEFT JOIN profiles name ON name."messageId" = (SELECT "messageId"
                                                                  FROM profiles
                                                                  WHERE creator = u.name
                                                                    AND subtype = 'NAME'
                                                                  ORDER BY "createdAt" DESC LIMIT 1)
              JOIN profiles idcommitment
          ON idcommitment."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'CUSTOM' AND key ='id_commitment' ORDER BY "createdAt" DESC LIMIT 1)
              JOIN connections invite ON invite.subtype = 'MEMBER_INVITE' AND invite.creator = u.name AND invite.name = :member_address
              JOIN connections accept ON accept.subtype = 'MEMBER_ACCEPT' AND accept.creator = :member_address AND accept.name = u.name
      `,
      {
        replacements: {
          member_address: address,
        },
        type: QueryTypes.SELECT,
      }
    );
    res.send(makeResponse(values));
  };

  search = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const query = req.params.query;
    const context = req.header('x-contextual-name') || undefined;
    const usersDB = await this.call('db', 'getUsers');
    const users = await usersDB.search(query || '', context, offset, limit);
    const result = [];

    for (const user of users) {
      const ens = await this.call('ens', 'fetchNameByAddress', user.username);
      result.push({ ens, ...user });
    }

    res.send(makeResponse(result));
  };

  getNotifications = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const { address } = req.params;
    const values = await sequelize.query(
      `
        SELECT p."messageId" as message_id, m.subtype as type, m."createdAt" as timestamp,  m.creator as creator, null as sender_pubkey FROM moderations m
        JOIN posts p on p."messageId" = m.reference
        WHERE m.subtype = 'LIKE'
        AND p.creator = :address
        UNION
        SELECT p."messageId" as message_id, p.subtype as type, p."createdAt" as timestamp,  p.creator as creator, null as sender_pubkey FROM posts p
        JOIN posts op on op."messageId" = p.reference AND p.subtype = 'REPLY'
        AND op.creator = :address
        UNION
        SELECT p."messageId" as message_id, p.subtype as type, p."createdAt" as timestamp,  p.creator as creator, null as sender_pubkey FROM posts p
        JOIN posts op on op."messageId" = p.reference AND p.subtype = 'REPOST'
        AND op.creator = :address
        UNION
        SELECT invite."messageId" as message_id, invite.subtype as type, invite."createdAt" as timestamp, invite.creator as creator, null as sender_pubkey FROM users u
        LEFT JOIN profiles name ON name."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'NAME' ORDER BY "createdAt" DESC LIMIT 1)
        JOIN profiles idcommitment ON idcommitment."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'CUSTOM' AND key='id_commitment' ORDER BY "createdAt" DESC LIMIT 1)
        JOIN connections invite ON invite.subtype = 'MEMBER_INVITE' AND invite.creator = u.name AND invite.name = :address
        LEFT JOIN connections accept ON accept.subtype = 'MEMBER_ACCEPT' AND accept.creator = :address AND accept.name = u.name
        UNION
        SELECT accept."messageId" as message_id, accept.subtype as type, accept."createdAt" as timestamp, accept.creator as creator, null as sender_pubkey FROM users u
        LEFT JOIN profiles name ON name."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'NAME' ORDER BY "createdAt" DESC LIMIT 1)
        JOIN profiles idcommitment ON idcommitment."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'CUSTOM' AND key='id_commitment' ORDER BY "createdAt" DESC LIMIT 1)
        JOIN connections invite ON invite.subtype = 'MEMBER_INVITE' AND invite.creator = :address AND invite.name = u.name
        JOIN connections accept ON accept.subtype = 'MEMBER_ACCEPT' AND accept.creator = u.name AND accept.name = :address
        UNION
        SELECT p."messageId" as message_id, 'MENTION' as type, p."createdAt" as timestamp,  p.creator as creator, null as sender_pubkey FROM tags t
        JOIN posts p ON p."messageId" = t.message_id
        WHERE t.tag_name = CONCAT('@', :address)
        ORDER BY timestamp DESC
        LIMIT :limit OFFSET :offset
      `,
      {
        replacements: {
          address: address,
          limit,
          offset,
        },
        type: QueryTypes.SELECT,
      }
    );
    res.send(makeResponse(values));
  };

  getUnreadNotificationCounts = async (req: Request, res: Response) => {
    const { address } = req.params;
    const lastReadDB = await this.call('db', 'getLastRead');
    const result = await lastReadDB.getLastRead(address, '');
    const lastRead = result?.lastread || 0;
    const values = await sequelize.query(
      `
        SELECT tem.type, COUNT(*)
        FROM (
          SELECT p."messageId" as message_id, m.subtype as type, m."createdAt" as timestamp,  m.creator as creator, null as sender_pubkey FROM moderations m
          JOIN posts p on p."messageId" = m.reference
          WHERE m.subtype = 'LIKE'
          AND p.creator = :address
          AND m."createdAt" > :lastRead
          UNION
          SELECT p."messageId" as message_id, p.subtype as type, p."createdAt" as timestamp,  p.creator as creator, null as sender_pubkey FROM posts p
          JOIN posts op on op."messageId" = p.reference AND p.subtype = 'REPLY'
          AND op.creator = :address
          AND p."createdAt" > :lastRead
          UNION
          SELECT p."messageId" as message_id, p.subtype as type, p."createdAt" as timestamp,  p.creator as creator, null as sender_pubkey FROM posts p
          JOIN posts op on op."messageId" = p.reference AND p.subtype = 'REPOST'
          AND op.creator = :address
          AND p."createdAt" > :lastRead
          UNION
          SELECT invite."messageId" as message_id, invite.subtype as type, invite."createdAt" as timestamp, invite.creator as creator, null as sender_pubkey FROM users u
          LEFT JOIN profiles name ON name."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'NAME' ORDER BY "createdAt" DESC LIMIT 1)
          JOIN profiles idcommitment ON idcommitment."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'CUSTOM' AND key='id_commitment' ORDER BY "createdAt" DESC LIMIT 1)
          JOIN connections invite ON invite.subtype = 'MEMBER_INVITE' AND invite.creator = u.name AND invite.name = :address
          LEFT JOIN connections accept ON accept.subtype = 'MEMBER_ACCEPT' AND accept.creator = :address AND accept.name = u.name
          WHERE invite."createdAt" > :lastRead
          UNION
          SELECT accept."messageId" as message_id, accept.subtype as type, accept."createdAt" as timestamp, accept.creator as creator, null as sender_pubkey FROM users u
          LEFT JOIN profiles name ON name."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'NAME' ORDER BY "createdAt" DESC LIMIT 1)
          JOIN profiles idcommitment ON idcommitment."messageId" = (SELECT "messageId" FROM profiles WHERE creator = u.name AND subtype = 'CUSTOM' AND key='id_commitment' ORDER BY "createdAt" DESC LIMIT 1)
          JOIN connections invite ON invite.subtype = 'MEMBER_INVITE' AND invite.creator = :address AND invite.name = u.name
          JOIN connections accept ON accept.subtype = 'MEMBER_ACCEPT' AND accept.creator = u.name AND accept.name = :address
          WHERE accept."createdAt" > :lastRead
          UNION
          SELECT p."messageId" as message_id, 'MENTION' as type, p."createdAt" as timestamp,  p.creator as creator, null as sender_pubkey FROM tags t
          JOIN posts p ON p."messageId" = t.message_id
          WHERE t.tag_name = CONCAT('@',:address)
          AND p."createdAt" > :lastRead
        ) AS tem
        GROUP BY type
        ORDER BY type
      `,
      {
        replacements: {
          address: address,
          lastRead,
        },
        type: QueryTypes.SELECT,
      }
    );
    res.send(
      makeResponse(
        values.reduce((map: any, val: any) => {
          map[val.type] = Number(val.count);
          map.TOTAL = map.TOTAL || 0;
          map.TOTAL += Number(val.count);
          return map;
        }, {})
      )
    );
  };
}
