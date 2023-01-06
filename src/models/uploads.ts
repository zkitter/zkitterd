import { Mutex } from 'async-mutex';
import { BIGINT, Sequelize, STRING } from 'sequelize';

export type UploadModel = {
  cid: string;
  filename: string;
  username: string;
  size: number;
  mimetype: string;
};

const mutex = new Mutex();

const uploads = (sequelize: Sequelize) => {
  const model = sequelize.define(
    'uploads',
    {
      cid: {
        type: STRING,
      },
      filename: {
        type: STRING,
      },
      mimetype: {
        type: STRING,
      },
      size: {
        type: BIGINT,
      },
      username: {
        type: STRING,
      },
    },
    {
      indexes: [
        { fields: ['cid'] },
        { fields: ['filename'] },
        { fields: ['username'] },
        { fields: ['mimetype'] },
      ],
    }
  );

  const addUploadData = async (data: UploadModel) => {
    return mutex.runExclusive(async () => {
      return await model.create(data);
    });
  };

  const removeUploadData = async (cid: string, filename: string) => {
    return mutex.runExclusive(async () => {
      try {
        return await model.destroy({
          where: {
            cid,
            filename,
          },
        });
      } catch (e) {
        return false;
      }
    });
  };

  const getTotalUploadByUser = async (username: string) => {
    const res = await model.sum('size', {
      where: {
        username,
      },
    });

    if (isNaN(res)) return 0;

    return res;
  };

  return {
    addUploadData,
    getTotalUploadByUser,
    model,
    removeUploadData,
  };
};

export default uploads;
