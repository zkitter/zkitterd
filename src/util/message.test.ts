import tape from 'tape';

import {
  Connection,
  ConnectionMessageSubType,
  MessageType,
  Moderation,
  ModerationMessageSubType,
  Post,
  PostMessageSubType,
  Profile,
  ProfileMessageSubType,
} from './message';

tape('message.ts', async t => {
  const post1 = new Post({
    type: MessageType.Post,
    subtype: PostMessageSubType.Default,
    creator: '0xmyuser',
    payload: {
      content: 'hello world',
    },
  });

  const mod1 = new Moderation({
    type: MessageType.Moderation,
    subtype: ModerationMessageSubType.Like,
    creator: '0xmyuser',
    payload: {
      reference: '0xmyuser/' + post1.hash(),
    },
  });

  const conn1 = new Connection({
    type: MessageType.Connection,
    subtype: ConnectionMessageSubType.Follow,
    creator: '0xmyuser',
    payload: {
      name: '0xotheruser',
    },
  });

  const pfp1 = new Profile({
    type: MessageType.Profile,
    subtype: ProfileMessageSubType.Name,
    creator: '0xmyuser',
    payload: {
      value: 'tsuk',
    },
  });

  t.deepEqual(
    Post.fromHex(post1.toHex()).toJSON(),
    post1.toJSON(),
    'should serialize and deserialize Post'
  );

  t.deepEqual(
    Moderation.fromHex(mod1.toHex()).toJSON(),
    mod1.toJSON(),
    'should serialize and deserialize Moderation'
  );

  t.deepEqual(
    Connection.fromHex(conn1.toHex()).toJSON(),
    conn1.toJSON(),
    'should serialize and deserialize Connection'
  );

  t.deepEqual(
    Profile.fromHex(pfp1.toHex()).toJSON(),
    pfp1.toJSON(),
    'should serialize and deserialize Profile'
  );

  t.end();
});
