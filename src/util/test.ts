import * as csv from 'csv';
import fs from 'fs';
import path from 'path';

import DBService from '../services/db';

const gunpath = path.join(process.cwd(), 'gun.test.db');

if (fs.existsSync(gunpath)) fs.unlinkSync(gunpath);

export const getMockDB = async () => {
  const db = new DBService();
  await db.start();

  await Promise.all([
    parse('connections.csv', db.connections!.createConnection),
    parse('ens.csv', ({ ens, address }) => db!.ens!.update(ens, address)),
    parse('interep_groups.csv', ({ root_hash, provider, name }) =>
      db!.interepGroups!.addHash(root_hash, provider, name)
    ),
    parse('links.csv', db.linkPreview!.update),
    parse('meta.csv', db.meta!.update),
    parse('moderations.csv', db.moderations!.createModeration),
    parse('posts.csv', db.posts!.createPost),
    db.posts?.vectorizeContent(),
    parse('profiles.csv', db.profiles!.createProfile),
    parse('semaphore_creators.csv', ({ group, provider, message_id }) =>
      db!.semaphoreCreators!.addSemaphoreCreator(message_id, provider, group)
    ),
    parse('semaphores.csv', ({ id_commitment, provider, name }) =>
      db!.semaphore!.addID(id_commitment, provider, name)
    ),
    parse('tags.csv', ({ tag_name, message_id }) => db!.tags!.addTagPost(tag_name, message_id)),
    parse('threads.csv', ({ root_id, message_id }) =>
      db!.threads!.addThreadData(root_id, message_id)
    ),
    parse('usermeta.csv', db.userMeta!.update),
    parse('users.csv', db.users!.updateOrCreateUser),
  ]);
  return db;
};

const parse = async (filename: string, insertFn: (data: any) => any) => {
  return new Promise((resolve, reject) => {
    const buf = fs.readFileSync(path.join(process.cwd(), 'static', 'tests', filename));
    csv.parse(
      buf,
      {
        delimiter: ',',
        skip_empty_lines: true,
        columns: true,
      },
      async (err, rows) => {
        if (err) return reject(err);
        await Promise.all(rows.map((row: any) => insertFn(row)));
        resolve(rows);
      }
    );
  });
};
