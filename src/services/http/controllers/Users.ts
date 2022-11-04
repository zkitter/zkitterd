import { Request, Response } from 'express';
import Web3 from 'web3';

import { Controller } from './interface';
import { makeResponse } from '../utils';

export class UsersController extends Controller {
  constructor() {
    super();
    this.init();
  }

  addRoutes = () => {
    this.router.route('/users').get(this.all).post(this.add);
    this.router.get('/users/:address', this.one);
    this.router.get('/:user/followers', this.followers);
    this.router.get('/:user/followings', this.followings);
    this.router.get('/:creator/replies', this.replies);
    this.router.get('/:creator/likes', this.likes);
    this.router.get('/users/search/:query?', this.search);
  };

  all = async (req: Request, res: Response) => {
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

  one = async (req: Request, res: Response) => {
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

  add = async (req: Request, res: Response) => {
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

  followers = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const user = req.params.user;
    const connectionsDB = await this.call('db', 'getConnections');
    const followers = await connectionsDB.findAllFollowersByName(user, offset, limit);
    res.send(makeResponse(followers));
  };

  followings = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const user = req.params.user;
    const connectionsDB = await this.call('db', 'getConnections');
    const followings = await connectionsDB.findAllFollowingsByCreator(user, offset, limit);
    res.send(makeResponse(followings));
  };

  replies = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const creator = req.params.creator;
    const context = req.header('x-contextual-name') || undefined;
    const postDB = await this.call('db', 'getPosts');
    const posts = await postDB.findAllRepliesFromCreator(creator, context, offset, limit);
    res.send(makeResponse(posts));
  };

  likes = async (req: Request, res: Response) => {
    const limit = req.query.limit && Number(req.query.limit);
    const offset = req.query.offset && Number(req.query.offset);
    const creator = req.params.creator;
    const context = req.header('x-contextual-name') || undefined;
    const postDB = await this.call('db', 'getPosts');
    const posts = await postDB.findAllLikedPostsByCreator(creator, context, offset, limit);
    res.send(makeResponse(posts));
  };
}
