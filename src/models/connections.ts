import { BIGINT, Sequelize, STRING } from 'sequelize';

import { ConnectionMessageSubType } from '@util/message';

type ConnectionModel = {
  messageId: string;
  hash: string;
  creator: string;
  type: string;
  subtype: string;
  createdAt: number;
  name: string;
};

const connections = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'connections',
    {
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
      name: {
        type: STRING,
      },
      subtype: {
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
        { fields: ['name'] },
        { fields: ['hash'], unique: true },
        { fields: ['messageId'], unique: true },
      ],
    }
  );

  const getAll = async (): Promise<ConnectionModel[]> => {
    const list = await model.findAll<any>();
    return list.map(data => data.toJSON());
  };

  const findOne = async (hash: string): Promise<ConnectionModel | null> => {
    const result: any = await model.findOne({
      where: {
        hash,
      },
    });

    if (!result) return null;

    const json = result.toJSON() as ConnectionModel;

    return json;
  };

  const remove = async (hash: string) => {
    return model.destroy({
      where: {
        hash,
      },
    });
  };

  const findAllByTargetName = async (
    name: string,
    offset = 0,
    limit = 20,
    order: 'DESC' | 'ASC' = 'DESC'
  ): Promise<ConnectionModel[]> => {
    const result = await model.findAll({
      limit,
      offset,
      order: [['createdAt', order]],
      where: {
        name,
      },
    });

    return result.map((r: any) => r.toJSON() as ConnectionModel);
  };

  const findAllFollowersByName = async (
    name: string,
    offset = 0,
    limit = 20,
    order: 'DESC' | 'ASC' = 'DESC'
  ): Promise<ConnectionModel[]> => {
    const result = await model.findAll({
      attributes: ['creator'],
      limit,
      offset,
      order: [['createdAt', order]],
      where: { name },
    });

    return result.map((r: any) => r.toJSON().creator);
  };

  const findAllFollowingsByCreator = async (
    creator: string,
    offset = 0,
    limit = 20,
    order: 'DESC' | 'ASC' = 'DESC'
  ): Promise<ConnectionModel[]> => {
    const result = await model.findAll({
      attributes: ['name'],
      limit,
      offset,
      order: [['createdAt', order]],
      where: { creator },
    });

    return result.map((r: any) => r.toJSON().name);
  };

  const createConnection = async (record: ConnectionModel) => {
    return model.create(record);
  };

  const findMemberInvite = async (groupAddress: string, memberAddress: string) => {
    const result: any = await model.findOne({
      where: {
        creator: groupAddress,
        name: memberAddress,
        subtype: ConnectionMessageSubType.MemberInvite,
      },
    });

    if (!result) return null;

    const json = result.toJSON() as ConnectionModel;

    return json;
  };

  return {
    createConnection,
    findAllByTargetName,
    findAllFollowersByName,
    findAllFollowingsByCreator,
    findMemberInvite,
    findOne,
    model,
    remove,
    getAll,
  };
};

export default connections;
