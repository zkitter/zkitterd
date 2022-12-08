import { json, Request, Response } from 'express';
import { QueryTypes } from 'sequelize';
import Web3 from 'web3';

import { Controller } from './interface';
import { makeResponse } from '../utils';
import { sequelize } from '../../../util/sequelize';

export class UsersController extends Controller {
  prefix = '/v1';

  constructor() {
    super();
    this.addRoutes();
  }

  addRoutes = () => {
    this._router.route('/users').get(this.getMany).post(this.addOne);
    this._router.get('/users/:address', this.getOne);
    this._router.get('/:user/followers', this.getFollowers);
    this._router.get('/:user/followings', this.getFollowings);
    this._router.get('/:creator/replies', this.getReplies);
    this._router.get('/:creator/likes', this.getLikes);
    this._router.get('/:address/groups', this.getGroups);
    this._router.get('/users/search/:query?', this.search);
  };

  getMany = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const context = req.header('x-contextual-name') || undefined;
    const usersDB = await this.call('db', 'getUsers');
    const users = await usersDB.readAll(context, offset, limit);

    const result = [];
    // console.log({ usersDB, users });
    for (let user of users) {
      const ens = await this.call('ens', 'fetchNameByAddress', user.username);
      result.push({ ens, ...user });
    }

    res.send(makeResponse(result));
  };

  addOne = async (req: Request, res: Response) => {
    const { account, publicKey, proof } = req.body;

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
        ens: ens,
        address: address,
        username: address,
      })
    );
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
        type: QueryTypes.SELECT,
        replacements: {
          member_address: address,
        },
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

    for (let user of users) {
      const ens = await this.call('ens', 'fetchNameByAddress', user.username);
      result.push({ ens, ...user });
    }

    res.send(makeResponse(result));
  };
}
