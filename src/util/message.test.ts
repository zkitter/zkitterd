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
    creator: '0xmyuser',
    payload: {
      content: 'hello world',
    },
    subtype: PostMessageSubType.Default,
    type: MessageType.Post,
  });

  const mod1 = new Moderation({
    creator: '0xmyuser',
    payload: {
      reference: '0xmyuser/' + post1.hash(),
    },
    subtype: ModerationMessageSubType.Like,
    type: MessageType.Moderation,
  });

  const conn1 = new Connection({
    creator: '0xmyuser',
    payload: {
      name: '0xotheruser',
    },
    subtype: ConnectionMessageSubType.Follow,
    type: MessageType.Connection,
  });

  const pfp1 = new Profile({
    creator: '0xmyuser',
    payload: {
      value: 'tsuk',
    },
    subtype: ProfileMessageSubType.Name,
    type: MessageType.Profile,
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
