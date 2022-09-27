import * as csv from 'csv';
import fs from 'fs';
import path from 'path';
import DBService from '../services/db';

let db: DBService | null = null;

const gunpath = path.join(process.cwd(), 'gun.test.db');
const dbpath = path.join(process.cwd(), 'test.db');

if (fs.existsSync(gunpath)) fs.unlinkSync(gunpath);
if (fs.existsSync(dbpath)) fs.unlinkSync(dbpath);

export const getMockDB = async () => {
    if (!db) {
        db = new DBService();
        await db.start();

        await parse('connections.csv', db.connections!.createConnection);
        await parse('ens.csv', ({ ens, address }) => db!.ens!.update(ens, address));
        await parse('interep_groups.csv', ({ root_hash, provider, name }) =>
            db!.interepGroups!.addHash(root_hash, provider, name)
        );
        await parse('links.csv', db.linkPreview!.update);
        await parse('meta.csv', db.meta!.update);
        await parse('moderations.csv', db.moderations!.createModeration);
        await parse('posts.csv', db.posts!.createPost);
        await parse('profiles.csv', db.profiles!.createProfile);
        await parse('semaphore_creators.csv', ({ group, provider, message_id }) =>
            db!.semaphoreCreators!.addSemaphoreCreator(message_id, provider, group)
        );
        await parse('semaphores.csv', ({ id_commitment, provider, name }) =>
            db!.semaphore!.addID(id_commitment, provider, name)
        );
        await parse('tags.csv', ({ tag_name, message_id }) =>
            db!.tags!.addTagPost(tag_name, message_id)
        );
        await parse('threads.csv', ({ root_id, message_id }) =>
            db!.threads!.addThreadData(root_id, message_id)
        );
        await parse('usermeta.csv', db.userMeta!.update);
        await parse('users.csv', db.users!.updateOrCreateUser);
    }

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
