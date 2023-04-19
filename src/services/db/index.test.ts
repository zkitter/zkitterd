import fs from 'fs';
import path from 'path';
import tape from 'tape';
import { getMockDB } from '@util/test';

tape('DBService', async t => {
  const db = await getMockDB();

  t.equal(db.app, await db.getApp());
  t.equal(db.users, await db.getUsers());
  t.equal(db.posts, await db.getPosts());
  t.equal(db.connections, await db.getConnections());
  t.equal(db.moderations, await db.getModerations());
  t.equal(db.profiles, await db.getProfiles());
  t.equal(db.meta, await db.getMeta());
  t.equal(db.tags, await db.getTags());
  t.equal(db.userMeta, await db.getUserMeta());
  t.equal(db.twitterAuth, await db.getTwitterAuth());
  t.equal(db.ens, await db.getENS());
  t.equal(db.linkPreview, await db.getLinkPreview());
  t.equal(db.semaphore, await db.getSemaphore());
  t.equal(db.semaphoreCreators, await db.getSemaphoreCreators());
  t.equal(db.threads, await db.getThreads());

  // @ts-expect-error
  const { createdAt, updatedAt, ...appData } = await db.app?.read();

  [
    'lastArbitrumBlockScanned',
    'lastENSBlockScanned',
    'lastInterrepBlockScanned',
    'lastGroup42BlockScanned',
  ].forEach(k => {
    // @ts-expect-error
    t.equal(typeof appData[k], 'number', 'should read and write app');
  });

  // @ts-expect-error
  const { updatedAt, ...conn1 } = await db.connections?.findOne(
    '112abaddfa6c4861d5a2a7f63fb2e4a56ae5c97dd91f2f0d8bb402a845709890'
  );
  t.deepEqual(
    conn1.hash,
    '112abaddfa6c4861d5a2a7f63fb2e4a56ae5c97dd91f2f0d8bb402a845709890',
    'should find one connection'
  );

  const conns = await db.connections!.findAllByTargetName(
    '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb'
  );
  t.deepEqual(
    conns.map(({ hash }) => hash),
    [
      '29a7566348f132eb2db31ad950fafef0f658de3bf7e07113c8898c67ac79a794',
      'cd259039af550d85c7d635b227fa7666334bb8734727e3731303292fa27adbbb',
    ],
    'should find one connection'
  );

  const ens1 = await db.ens!.readByAddress('0xd44a82dD160217d46D754a03C8f841edF06EBE3c');
  t.deepEqual(ens1.ens, 'yagamilight.eth', 'should return ens name');

  const ens2 = await db.ens!.readByENS('yagamilight.eth');
  t.deepEqual(ens2.address, '0xd44a82dD160217d46D754a03C8f841edF06EBE3c', 'should return address');

  const link1 = await db.linkPreview!.read(
    'https://c.tenor.com/G1DmbkkM46cAAAAC/eimi-fukada-eimi-dance.gif'
  );
  t.deepEqual(link1!.contentType, 'image/gif', 'should return link by url');

  const meta1 = await db.meta!.findOne(
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/8f7e627373283807338846710c7a9ab3484e295127bc0c4d19f58829b4bbe195'
  );
  t.deepEqual(
    meta1,
    { likeCount: 1, liked: null, postCount: 0, replyCount: 0, repostCount: 0, reposted: null },
    'should return meta by message id'
  );

  t.deepEqual(
    await db.meta!.findTags(),
    [
      { postCount: 9, tagName: '#TODO' },
      { postCount: 6, tagName: '#test' },
      { postCount: 2, tagName: '#autism' },
      { postCount: 1, tagName: '#bug' },
    ],
    'should return tags'
  );

  await db.meta!.addLike(
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/8f7e627373283807338846710c7a9ab3484e295127bc0c4d19f58829b4bbe195'
  );
  t.deepEqual(
    await db.meta!.findOne(
      '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/8f7e627373283807338846710c7a9ab3484e295127bc0c4d19f58829b4bbe195'
    ),
    { likeCount: 2, liked: null, postCount: 0, replyCount: 0, repostCount: 0, reposted: null },
    'should add post counts'
  );

  // @ts-expect-error
  const { updatedAt, ...mod1 } = await db.moderations!.findOne(
    '8f24b1ae868cbc87a509dbba582af6e396460237b88ad9f09644fa65e44deed9'
  );
  t.deepEqual(
    mod1,
    {
      createdAt: '1646285327701',
      creator: '0x3F425586D68616A113C29c303766DAD444167EE8',
      hash: '8f24b1ae868cbc87a509dbba582af6e396460237b88ad9f09644fa65e44deed9',
      messageId:
        '0x3F425586D68616A113C29c303766DAD444167EE8/8f24b1ae868cbc87a509dbba582af6e396460237b88ad9f09644fa65e44deed9',
      reference: '945bb091bfadd460418c36ce6274d6a4f9689aaca1b95879ffe35ca7a4eded5b',
      subtype: 'LIKE',
      type: 'MODERATION',
    },
    'should return one moderation'
  );

  // @ts-expect-error
  const [{ updatedAt, ...mod2 }] = await db.moderations!.findThreadModeration(
    '0x3F425586D68616A113C29c303766DAD444167EE8/d3f9955efd39a068b1b1482040c9ff6d429263987282ced9e296c07dc8e0126c'
  );
  t.deepEqual(
    mod2,
    {
      createdAt: '1648193705500',
      creator: '0x3F425586D68616A113C29c303766DAD444167EE8',
      hash: '691336cb1993b3f689414a415bfe7ddf84e7fcb4c4a439cf7cc299878676cfd8',
      messageId:
        '0x3F425586D68616A113C29c303766DAD444167EE8/691336cb1993b3f689414a415bfe7ddf84e7fcb4c4a439cf7cc299878676cfd8',
      reference:
        '0x3F425586D68616A113C29c303766DAD444167EE8/d3f9955efd39a068b1b1482040c9ff6d429263987282ced9e296c07dc8e0126c',
      subtype: 'THREAD_ONLY_MENTION',
      type: 'MODERATION',
    },
    'should return thread moderation'
  );

  const mod3 = await db.moderations!.findAllByReference(
    '0x3aec555a667EF810C4B0a0D064D6Fb7c66161360/899e3621100ce2d3411431ca777cea7fa0223fccec9ab073181bd7ee65a64456'
  );
  t.deepEqual(
    mod3.map(({ messageId }) => messageId),
    [
      '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/3ae9158b74ff7cd02a5638d751a605dd9e930b1201a167d498eabd0f0c331692',
      '0x3aec555a667EF810C4B0a0D064D6Fb7c66161360/2b42df13964e8075ca65a46eea44e31459130e6d09ef97f259dabfda5536dcda',
    ],
    'should return all moderation'
  );

  const post1 = await db.posts!.findRoot(
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/1b18998ef35ecbb35760e71f6531f75912f79a9162eadfae90bb4e8740aa132b'
  );
  t.deepEqual(
    post1,
    '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
    'should return root'
  );

  const post2 = await db.posts!.findOne(
    'd0b437c184c3600f0e87921957e352dac895da11110e94f68985d9a5b38f3f9b',
    '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb'
  );
  t.deepEqual(
    post2,
    {
      createdAt: '1648193678747',
      hash: 'd0b437c184c3600f0e87921957e352dac895da11110e94f68985d9a5b38f3f9b',
      messageId:
        '0x3F425586D68616A113C29c303766DAD444167EE8/d0b437c184c3600f0e87921957e352dac895da11110e94f68985d9a5b38f3f9b',
      meta: {
        blocked: null,
        interepGroup: null,
        interepProvider: null,
        likeCount: 0,
        liked: null,
        modblockedctx: null,
        modBlockedPost: null,
        modBlockedUser: null,
        moderation: 'THREAD_ONLY_MENTION',
        modfollowedctx: null,
        modFollowerUser: null,
        modLikedPost: null,
        modmentionedctx:
          '0x3F425586D68616A113C29c303766DAD444167EE8/d0b437c184c3600f0e87921957e352dac895da11110e94f68985d9a5b38f3f9b',
        replyCount: 0,
        repostCount: 0,
        reposted: null,
        rootId:
          '0x3F425586D68616A113C29c303766DAD444167EE8/d0b437c184c3600f0e87921957e352dac895da11110e94f68985d9a5b38f3f9b',
      },
      payload: {
        attachment: '',
        content:
          '@0x3aec555a667EF810C4B0a0D064D6Fb7c66161360 @0x5d432ce201d2c03234e314d4703559102Ebf365C @0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb ',
        reference: '',
        title: '',
        topic: 'https://twitter.com/AutismDev/status/1507259650093182977',
      },
      subtype: 'M_POST',
      type: 'POST',
    },
    'should return post'
  );

  const post3 = await db.posts!.findAllPosts(
    '',
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
    0,
    5
  );
  t.deepEqual(
    post3,
    [
      {
        createdAt: '1648192630248',
        hash: '1bd96ba61f182f1619668040f8845a36d230dda686f8c8e7b8502568dac18e95',
        messageId:
          '0x3F425586D68616A113C29c303766DAD444167EE8/1bd96ba61f182f1619668040f8845a36d230dda686f8c8e7b8502568dac18e95',
        meta: {
          blocked: null,
          interepGroup: null,
          interepProvider: null,
          likeCount: 0,
          liked: null,
          modblockedctx: null,
          modBlockedPost: null,
          modBlockedUser: null,
          moderation: null,
          modfollowedctx:
            '0x3F425586D68616A113C29c303766DAD444167EE8/6cb3a3eea1355ead9cbcb0907e282eac3d1f606d7a8d77252445404a09d58584',
          modFollowerUser: null,
          modLikedPost: null,
          modmentionedctx: null,
          replyCount: 0,
          repostCount: 0,
          reposted: null,
          rootId:
            '0x3F425586D68616A113C29c303766DAD444167EE8/1bd96ba61f182f1619668040f8845a36d230dda686f8c8e7b8502568dac18e95',
        },
        payload: {
          attachment: '',
          content: 'asdfasdfasdfasd asdfasdf asdfasdf',
          reference: '',
          title: '',
          topic: 'https://twitter.com/AutismDev/status/1507255252461842438',
        },
        subtype: 'M_POST',
        type: 'POST',
      },
      {
        createdAt: '1648192605180',
        hash: 'db51fd8dd7d710c56ef9cca92ee3bc1e332d029f78a67f09d22087a2ac3be038',
        messageId: 'db51fd8dd7d710c56ef9cca92ee3bc1e332d029f78a67f09d22087a2ac3be038',
        meta: {
          blocked: null,
          interepGroup: 'not_sufficient',
          interepProvider: 'twitter',
          likeCount: 0,
          liked: null,
          modblockedctx: null,
          modBlockedPost: null,
          modBlockedUser: null,
          moderation: null,
          modfollowedctx: null,
          modFollowerUser: null,
          modLikedPost: null,
          modmentionedctx: null,
          replyCount: 0,
          repostCount: 0,
          reposted: null,
          rootId: 'db51fd8dd7d710c56ef9cca92ee3bc1e332d029f78a67f09d22087a2ac3be038',
        },
        payload: {
          attachment: '',
          content: 'asdfasdf',
          reference: '',
          title: '',
          topic: '',
        },
        subtype: '',
        type: 'POST',
      },
      {
        createdAt: '1648093704735',
        hash: '6c62eb251be69ca722e5a615f616ce68b6ad3378b4568c93e34cad455905cc9a',
        messageId: '6c62eb251be69ca722e5a615f616ce68b6ad3378b4568c93e34cad455905cc9a',
        meta: {
          blocked: null,
          interepGroup: 'not_sufficient',
          interepProvider: 'twitter',
          likeCount: 0,
          liked: null,
          modblockedctx: null,
          modBlockedPost: null,
          modBlockedUser: null,
          moderation: null,
          modfollowedctx: null,
          modFollowerUser: null,
          modLikedPost: null,
          modmentionedctx: null,
          replyCount: 1,
          repostCount: 0,
          reposted: null,
          rootId: '6c62eb251be69ca722e5a615f616ce68b6ad3378b4568c93e34cad455905cc9a',
        },
        payload: {
          attachment: 'https://c.tenor.com/G1DmbkkM46cAAAAC/eimi-fukada-eimi-dance.gif',
          content: '',
          reference: '',
          title: '',
          topic: '',
        },
        subtype: '',
        type: 'POST',
      },
      {
        createdAt: '1648093364657',
        hash: '899e3621100ce2d3411431ca777cea7fa0223fccec9ab073181bd7ee65a64456',
        messageId:
          '0x3aec555a667EF810C4B0a0D064D6Fb7c66161360/899e3621100ce2d3411431ca777cea7fa0223fccec9ab073181bd7ee65a64456',
        meta: {
          blocked: null,
          interepGroup: null,
          interepProvider: null,
          likeCount: 1,
          liked:
            '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/3ae9158b74ff7cd02a5638d751a605dd9e930b1201a167d498eabd0f0c331692',
          modblockedctx: null,
          modBlockedPost: null,
          modBlockedUser: null,
          moderation: null,
          modfollowedctx: null,
          modFollowerUser: null,
          modLikedPost: null,
          modmentionedctx: null,
          replyCount: 0,
          repostCount: 0,
          reposted: null,
          rootId:
            '0x3aec555a667EF810C4B0a0D064D6Fb7c66161360/899e3621100ce2d3411431ca777cea7fa0223fccec9ab073181bd7ee65a64456',
        },
        payload: {
          attachment: '',
          content: 'gm everyone',
          reference: '',
          title: '',
          topic: '',
        },
        subtype: '',
        type: 'POST',
      },
      {
        createdAt: '1648001768213',
        hash: 'ca8462e60519167046ce106caca1c45c21bf7b198f2c29c2ee802dbb5c32ed6e',
        messageId:
          '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/ca8462e60519167046ce106caca1c45c21bf7b198f2c29c2ee802dbb5c32ed6e',
        meta: {
          blocked: null,
          interepGroup: null,
          interepProvider: null,
          likeCount: 1,
          liked: null,
          modblockedctx: null,
          modBlockedPost: null,
          modBlockedUser: null,
          moderation: null,
          modfollowedctx: null,
          modFollowerUser: null,
          modLikedPost: null,
          modmentionedctx: null,
          replyCount: 0,
          repostCount: 0,
          reposted: null,
          rootId:
            '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/ca8462e60519167046ce106caca1c45c21bf7b198f2c29c2ee802dbb5c32ed6e',
        },
        payload: {
          attachment: '',
          content: '#TODO PWA-ify mobile view',
          reference: '',
          title: '',
          topic: '',
        },
        subtype: '',
        type: 'POST',
      },
    ],
    'should return all posts'
  );

  const post4 = await db.posts!.findAllRepliesFromCreator(
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
    2,
    2
  );
  t.deepEqual(
    post4,
    [
      {
        createdAt: '1647989094705',
        hash: 'bdbcc91d89ad6953c90585641766f41554be6ed19b57389e42056a4a2f876f2a',
        messageId:
          '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/bdbcc91d89ad6953c90585641766f41554be6ed19b57389e42056a4a2f876f2a',
        meta: {
          blocked: null,
          interepGroup: null,
          interepProvider: null,
          likeCount: 0,
          liked: null,
          modblockedctx: null,
          modBlockedPost: null,
          modBlockedUser: null,
          moderation: null,
          modfollowedctx:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/2b002393948d0b27fd8d4ef2b8da12b966d5dcac113badeb616c076b07046f7a',
          modFollowerUser:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/2b002393948d0b27fd8d4ef2b8da12b966d5dcac113badeb616c076b07046f7a',
          modLikedPost: null,
          modmentionedctx: null,
          replyCount: 0,
          repostCount: 0,
          reposted: null,
          rootId:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/f0579814819379c975b732309aa52505ba55747a56fb1bb587e77929bfa8d2e5',
        },
        payload: {
          attachment: '',
          content: '#test',
          reference:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/f0579814819379c975b732309aa52505ba55747a56fb1bb587e77929bfa8d2e5',
          title: '',
          topic: '',
        },
        subtype: 'REPLY',
        type: 'POST',
      },
      {
        createdAt: '1647579193827',
        hash: 'b645028d763c0564e89d58d000e4844eed66358e51ecdb84d2f7f2a5864d2292',
        messageId:
          '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/b645028d763c0564e89d58d000e4844eed66358e51ecdb84d2f7f2a5864d2292',
        meta: {
          blocked: null,
          interepGroup: null,
          interepProvider: null,
          likeCount: 1,
          liked: null,
          modblockedctx: null,
          modBlockedPost: null,
          modBlockedUser: null,
          moderation: 'THREAD_ONLY_MENTION',
          modfollowedctx:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/23fbb7d13fcb649bba8e0fbd8f5fb830df8bf35e08ab5134544fd5731ef21543',
          modFollowerUser:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/23fbb7d13fcb649bba8e0fbd8f5fb830df8bf35e08ab5134544fd5731ef21543',
          modLikedPost:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/4a20a1924dd087e348e2bfa1cc5827300e471687b9e5b631cc27453c715310a2',
          modmentionedctx: null,
          replyCount: 0,
          repostCount: 0,
          reposted: null,
          rootId:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
        },
        payload: {
          attachment: '',
          content: 'teest asdfasdf ',
          reference:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
          title: '',
          topic: '',
        },
        subtype: 'REPLY',
        type: 'POST',
      },
    ],
    'should return replies from creator'
  );

  const post5 = await db.posts!.getHomeFeed('0xd44a82dD160217d46D754a03C8f841edF06EBE3c', 2, 2);
  t.deepEqual(
    post5,
    [
      {
        createdAt: '1648193678747',
        hash: 'd0b437c184c3600f0e87921957e352dac895da11110e94f68985d9a5b38f3f9b',
        messageId:
          '0x3F425586D68616A113C29c303766DAD444167EE8/d0b437c184c3600f0e87921957e352dac895da11110e94f68985d9a5b38f3f9b',
        meta: {
          blocked: null,
          interepGroup: null,
          interepProvider: null,
          likeCount: 0,
          liked: null,
          modblockedctx: null,
          modBlockedPost: null,
          modBlockedUser: null,
          moderation: 'THREAD_ONLY_MENTION',
          modfollowedctx:
            '0x3F425586D68616A113C29c303766DAD444167EE8/6cb3a3eea1355ead9cbcb0907e282eac3d1f606d7a8d77252445404a09d58584',
          modFollowerUser: null,
          modLikedPost: null,
          modmentionedctx: null,
          replyCount: 0,
          repostCount: 0,
          reposted: null,
          rootId:
            '0x3F425586D68616A113C29c303766DAD444167EE8/d0b437c184c3600f0e87921957e352dac895da11110e94f68985d9a5b38f3f9b',
        },
        payload: {
          attachment: '',
          content:
            '@0x3aec555a667EF810C4B0a0D064D6Fb7c66161360 @0x5d432ce201d2c03234e314d4703559102Ebf365C @0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb ',
          reference: '',
          title: '',
          topic: 'https://twitter.com/AutismDev/status/1507259650093182977',
        },
        subtype: 'M_POST',
        type: 'POST',
      },
      {
        createdAt: '1648192630248',
        hash: '1bd96ba61f182f1619668040f8845a36d230dda686f8c8e7b8502568dac18e95',
        messageId:
          '0x3F425586D68616A113C29c303766DAD444167EE8/1bd96ba61f182f1619668040f8845a36d230dda686f8c8e7b8502568dac18e95',
        meta: {
          blocked: null,
          interepGroup: null,
          interepProvider: null,
          likeCount: 0,
          liked: null,
          modblockedctx: null,
          modBlockedPost: null,
          modBlockedUser: null,
          moderation: null,
          modfollowedctx:
            '0x3F425586D68616A113C29c303766DAD444167EE8/6cb3a3eea1355ead9cbcb0907e282eac3d1f606d7a8d77252445404a09d58584',
          modFollowerUser: null,
          modLikedPost: null,
          modmentionedctx: null,
          replyCount: 0,
          repostCount: 0,
          reposted: null,
          rootId:
            '0x3F425586D68616A113C29c303766DAD444167EE8/1bd96ba61f182f1619668040f8845a36d230dda686f8c8e7b8502568dac18e95',
        },
        payload: {
          attachment: '',
          content: 'asdfasdfasdfasd asdfasdf asdfasdf',
          reference: '',
          title: '',
          topic: 'https://twitter.com/AutismDev/status/1507255252461842438',
        },
        subtype: 'M_POST',
        type: 'POST',
      },
    ],
    'should return home feed'
  );

  const post6 = await db.posts!.findAllReplies(
    '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c'
  );
  t.deepEqual(
    post6,
    [
      {
        createdAt: '1647564670980',
        hash: '699a260463efd7d6173a4af8fae4bc8b7d62fa1a3e13bcff8ba3de652d676b82',
        messageId:
          '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/699a260463efd7d6173a4af8fae4bc8b7d62fa1a3e13bcff8ba3de652d676b82',
        meta: {
          blocked: null,
          interepGroup: null,
          interepProvider: null,
          likeCount: 0,
          liked: null,
          modblockedctx: null,
          modBlockedPost: null,
          modBlockedUser: null,
          moderation: 'THREAD_ONLY_MENTION',
          modfollowedctx:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/23fbb7d13fcb649bba8e0fbd8f5fb830df8bf35e08ab5134544fd5731ef21543',
          modFollowerUser: null,
          modLikedPost: null,
          modmentionedctx: null,
          replyCount: 1,
          repostCount: 0,
          reposted: null,
          rootId:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
        },
        payload: {
          attachment: '',
          content: 'asdfa',
          reference:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
          title: '',
          topic: '',
        },
        subtype: 'REPLY',
        type: 'POST',
      },
      {
        createdAt: '1647579193827',
        hash: 'b645028d763c0564e89d58d000e4844eed66358e51ecdb84d2f7f2a5864d2292',
        messageId:
          '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/b645028d763c0564e89d58d000e4844eed66358e51ecdb84d2f7f2a5864d2292',
        meta: {
          blocked: null,
          interepGroup: null,
          interepProvider: null,
          likeCount: 1,
          liked: null,
          modblockedctx: null,
          modBlockedPost: null,
          modBlockedUser: null,
          moderation: 'THREAD_ONLY_MENTION',
          modfollowedctx:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/23fbb7d13fcb649bba8e0fbd8f5fb830df8bf35e08ab5134544fd5731ef21543',
          modFollowerUser:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/23fbb7d13fcb649bba8e0fbd8f5fb830df8bf35e08ab5134544fd5731ef21543',
          modLikedPost:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/4a20a1924dd087e348e2bfa1cc5827300e471687b9e5b631cc27453c715310a2',
          modmentionedctx: null,
          replyCount: 0,
          repostCount: 0,
          reposted: null,
          rootId:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
        },
        payload: {
          attachment: '',
          content: 'teest asdfasdf ',
          reference:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
          title: '',
          topic: '',
        },
        subtype: 'REPLY',
        type: 'POST',
      },
    ],
    'should return all replies of a ref'
  );

  const post7 = await db.posts!.findAllLikedPostsByCreator(
    '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63',
    '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63',
    0,
    2
  );
  t.deepEqual(
    post7,
    [
      {
        createdAt: '1647579193827',
        hash: 'b645028d763c0564e89d58d000e4844eed66358e51ecdb84d2f7f2a5864d2292',
        messageId:
          '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/b645028d763c0564e89d58d000e4844eed66358e51ecdb84d2f7f2a5864d2292',
        meta: {
          blocked: null,
          interepGroup: null,
          interepProvider: null,
          likeCount: 1,
          liked:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/4a20a1924dd087e348e2bfa1cc5827300e471687b9e5b631cc27453c715310a2',
          modblockedctx: null,
          modBlockedPost: null,
          modBlockedUser: null,
          moderation: 'THREAD_ONLY_MENTION',
          modfollowedctx: null,
          modFollowerUser:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/23fbb7d13fcb649bba8e0fbd8f5fb830df8bf35e08ab5134544fd5731ef21543',
          modLikedPost:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/4a20a1924dd087e348e2bfa1cc5827300e471687b9e5b631cc27453c715310a2',
          modmentionedctx: null,
          replyCount: 0,
          repostCount: 0,
          reposted: null,
          rootId:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
        },
        payload: {
          attachment: '',
          content: 'teest asdfasdf ',
          reference:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
          title: '',
          topic: '',
        },
        subtype: 'REPLY',
        type: 'POST',
      },
      {
        createdAt: '1647579176008',
        hash: '1b18998ef35ecbb35760e71f6531f75912f79a9162eadfae90bb4e8740aa132b',
        messageId:
          '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/1b18998ef35ecbb35760e71f6531f75912f79a9162eadfae90bb4e8740aa132b',
        meta: {
          blocked: null,
          interepGroup: null,
          interepProvider: null,
          likeCount: 1,
          liked:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/086e741d1ad02c278e79ac8fc03d0dc9f886f1b00d10edffb4c21997b00c1352',
          modblockedctx: null,
          modBlockedPost: null,
          modBlockedUser: null,
          moderation: 'THREAD_ONLY_MENTION',
          modfollowedctx: null,
          modFollowerUser:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/23fbb7d13fcb649bba8e0fbd8f5fb830df8bf35e08ab5134544fd5731ef21543',
          modLikedPost:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/086e741d1ad02c278e79ac8fc03d0dc9f886f1b00d10edffb4c21997b00c1352',
          modmentionedctx: null,
          replyCount: 0,
          repostCount: 0,
          reposted: null,
          rootId:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
        },
        payload: {
          attachment: '',
          content: 'test',
          reference:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/699a260463efd7d6173a4af8fae4bc8b7d62fa1a3e13bcff8ba3de652d676b82',
          title: '',
          topic: '',
        },
        subtype: 'REPLY',
        type: 'POST',
      },
    ],
    'should return all liked posts by a user'
  );

  // @ts-expect-error
  const { updatedAt, ...profile1 } = await db.profiles!.findOne(
    '8118b718d403045f3632c5a7f811676b5b6ff51477383758b630e380b34ba1a3'
  );
  t.deepEqual(
    profile1,
    {
      createdAt: '1634053438409',
      creator: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
      hash: '8118b718d403045f3632c5a7f811676b5b6ff51477383758b630e380b34ba1a3',
      key: '',
      messageId:
        '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/8118b718d403045f3632c5a7f811676b5b6ff51477383758b630e380b34ba1a3',
      subtype: 'NAME',
      type: 'PROFILE',
      value: '夜神 月',
    },
    'should return profile'
  );

  await db.posts!.createTwitterPosts([
    {
      attachment: '',
      content: 'Hello World,',
      createdAt: 1,
      creator: '',
      hash: 'testhash',
      messageId: 'testid',
      reference: 'testref',
      subtype: '',
      title: '',
      topic: '',
      type: '@TWEET@',
    },
  ]);

  // @ts-expect-error
  const { updatedAt, ...post8 } = await db.posts!.findLastTweetInConversation('testref');
  t.deepEqual(
    post8,
    {
      attachment: '',
      content: 'Hello World,',
      createdAt: '1',
      creator: '',
      hash: 'testhash',
      messageId: 'testid',
      proof: null,
      reference: 'testref',
      signals: null,
      subtype: '',
      title: '',
      topic: '',
      type: '@TWEET@',
    },
    'should return last tweet replies in a thread'
  );

  await db.posts!.ensurePost('0xcreator/testensureid');
  await db.posts!.createPost({
    attachment: '',
    content: 'hello create post!',
    createdAt: 1,
    creator: '0xcreator',
    hash: 'testensureid',
    messageId: '0xcreator/testensureid',
    reference: '',
    subtype: '',
    title: '',
    topic: '',
    type: 'POST',
  });

  const post9 = await db.posts!.findOne('testensureid');
  t.deepEqual(
    post9,
    {
      createdAt: '1',
      hash: 'testensureid',
      messageId: '0xcreator/testensureid',
      meta: {
        blocked: null,
        interepGroup: null,
        interepProvider: null,
        likeCount: 0,
        liked: null,
        modblockedctx: null,
        modBlockedPost: null,
        modBlockedUser: null,
        moderation: null,
        modfollowedctx: null,
        modFollowerUser: null,
        modLikedPost: null,
        modmentionedctx: null,
        replyCount: 0,
        repostCount: 0,
        reposted: null,
        rootId: null,
      },
      payload: {
        attachment: '',
        content: 'hello create post!',
        reference: '',
        title: '',
        topic: '',
      },
      subtype: '',
      type: 'POST',
    },
    'should return created post'
  );

  // @ts-expect-error
  const { createdAt, updatedAt, ...record1 } = await db.records!.findOne('#soul', '!field');
  t.deepEqual(
    record1,
    { field: '!field', id: 1, relation: '@utilrelation', soul: '#soul', state: 1, value: '@value' },
    'should return one record'
  );

  const sema2 = await db.semaphore!.findAllByCommitment(
    '11478604443530795445406842905228486956674818902660313591870165575138495663261'
  );
  t.deepEqual(
    sema2.map(d => d.id_commitment),
    ['11478604443530795445406842905228486956674818902660313591870165575138495663261'],
    'should return all semaphore rows'
  );

  const tag1 = await db.tags!.getPostsByTag(
    '#test',
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
    0,
    2
  );
  t.deepEqual(
    tag1,
    [
      {
        createdAt: '1647989094705',
        hash: 'bdbcc91d89ad6953c90585641766f41554be6ed19b57389e42056a4a2f876f2a',
        messageId:
          '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/bdbcc91d89ad6953c90585641766f41554be6ed19b57389e42056a4a2f876f2a',
        meta: {
          blocked: null,
          interepGroup: null,
          interepProvider: null,
          likeCount: 0,
          liked: null,
          modblockedctx: null,
          modBlockedPost: null,
          modBlockedUser: null,
          moderation: null,
          modfollowedctx:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/2b002393948d0b27fd8d4ef2b8da12b966d5dcac113badeb616c076b07046f7a',
          modFollowerUser:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/2b002393948d0b27fd8d4ef2b8da12b966d5dcac113badeb616c076b07046f7a',
          modLikedPost: null,
          modmentionedctx: null,
          replyCount: 0,
          repostCount: 0,
          reposted: null,
          rootId:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/f0579814819379c975b732309aa52505ba55747a56fb1bb587e77929bfa8d2e5',
        },
        payload: {
          attachment: '',
          content: '#test',
          reference:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/f0579814819379c975b732309aa52505ba55747a56fb1bb587e77929bfa8d2e5',
          title: '',
          topic: '',
        },
        subtype: 'REPLY',
        type: 'POST',
      },
      {
        createdAt: '1647989013660',
        hash: 'f0579814819379c975b732309aa52505ba55747a56fb1bb587e77929bfa8d2e5',
        messageId:
          '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/f0579814819379c975b732309aa52505ba55747a56fb1bb587e77929bfa8d2e5',
        meta: {
          blocked: null,
          interepGroup: null,
          interepProvider: null,
          likeCount: 0,
          liked: null,
          modblockedctx: null,
          modBlockedPost: null,
          modBlockedUser: null,
          moderation: null,
          modfollowedctx:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/2b002393948d0b27fd8d4ef2b8da12b966d5dcac113badeb616c076b07046f7a',
          modFollowerUser: null,
          modLikedPost: null,
          modmentionedctx: null,
          replyCount: 3,
          repostCount: 0,
          reposted: null,
          rootId:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/f0579814819379c975b732309aa52505ba55747a56fb1bb587e77929bfa8d2e5',
        },
        payload: { attachment: '', content: 'test #test', reference: '', title: '', topic: '' },
        subtype: '',
        type: 'POST',
      },
    ],
    'should return all posts by tag'
  );

  await db.tags!.removeTagPost(
    '#test',
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/bdbcc91d89ad6953c90585641766f41554be6ed19b57389e42056a4a2f876f2a'
  );

  const tag2 = await db.tags!.getPostsByTag(
    '#test',
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
    0,
    2
  );
  t.deepEqual(
    tag2,
    [
      {
        createdAt: '1647989013660',
        hash: 'f0579814819379c975b732309aa52505ba55747a56fb1bb587e77929bfa8d2e5',
        messageId:
          '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/f0579814819379c975b732309aa52505ba55747a56fb1bb587e77929bfa8d2e5',
        meta: {
          blocked: null,
          interepGroup: null,
          interepProvider: null,
          likeCount: 0,
          liked: null,
          modblockedctx: null,
          modBlockedPost: null,
          modBlockedUser: null,
          moderation: null,
          modfollowedctx:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/2b002393948d0b27fd8d4ef2b8da12b966d5dcac113badeb616c076b07046f7a',
          modFollowerUser: null,
          modLikedPost: null,
          modmentionedctx: null,
          replyCount: 3,
          repostCount: 0,
          reposted: null,
          rootId:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/f0579814819379c975b732309aa52505ba55747a56fb1bb587e77929bfa8d2e5',
        },
        payload: { attachment: '', content: 'test #test', reference: '', title: '', topic: '' },
        subtype: '',
        type: 'POST',
      },
      {
        createdAt: '1647575979244',
        hash: '30d6bb9d8275795bdab6d5eb5f14010fe98793f42f633024aa9de4c83e5a60f1',
        messageId:
          '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/30d6bb9d8275795bdab6d5eb5f14010fe98793f42f633024aa9de4c83e5a60f1',
        meta: {
          blocked: null,
          interepGroup: null,
          interepProvider: null,
          likeCount: 0,
          liked: null,
          modblockedctx: null,
          modBlockedPost: null,
          modBlockedUser: null,
          moderation: 'THREAD_HIDE_BLOCK',
          modfollowedctx:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/2b002393948d0b27fd8d4ef2b8da12b966d5dcac113badeb616c076b07046f7a',
          modFollowerUser:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/523017325d3ff5b7afbdb427b8ac3158adfe88256b76f597588a1ceb8ce2ef09',
          modLikedPost: null,
          modmentionedctx: null,
          replyCount: 0,
          repostCount: 0,
          reposted: null,
          rootId:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/dd528f6c8f108072ea6c055bb8cfe0f5cff406012a2e49794e3511f7ac62154a',
        },
        payload: {
          attachment: '',
          content: 'hey!!!! #test',
          reference:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/dd528f6c8f108072ea6c055bb8cfe0f5cff406012a2e49794e3511f7ac62154a',
          title: '',
          topic: '',
        },
        subtype: 'REPLY',
        type: 'POST',
      },
    ],
    'should return all posts by tag'
  );

  const thread1: any = await db.sequelize.query(
    `select *
     from threads
     where message_id =
           '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/25df09401b73ffd9d83b7dd57c489abd1065624d38a05d8be192d55295c43204'`
  );
  t.deepEqual(
    thread1[0][0].message_id,
    '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/25df09401b73ffd9d83b7dd57c489abd1065624d38a05d8be192d55295c43204',
    'should return query threads'
  );

  await db.threads!.removeThreadData(
    '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/25df09401b73ffd9d83b7dd57c489abd1065624d38a05d8be192d55295c43204',
    '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/25df09401b73ffd9d83b7dd57c489abd1065624d38a05d8be192d55295c43204'
  );

  const thread2: any = await db.sequelize.query(
    `select *
     from threads
     where message_id =
           '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/25df09401b73ffd9d83b7dd57c489abd1065624d38a05d8be192d55295c43204'`
  );
  t.notok(thread2[0][0], 'should remove thread data');

  // @ts-expect-error
  const { createdAt, updatedAt, ...um1 } = await db.userMeta!.findOne(
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c'
  );
  t.deepEqual(
    um1,
    {
      blockedCount: '0',
      blockingCount: '0',
      followerCount: '4',
      followingCount: '4',
      mentionedCount: '2',
      name: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
      postingCount: '22',
    },
    'should return user meta by name'
  );

  // @ts-expect-error
  const { createdAt, updatedAt, ...user1 } = await db.users!.findOneByName(
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
    '0x3F425586D68616A113C29c303766DAD444167EE8'
  );
  t.deepEqual(
    user1,
    {
      address: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
      bio: '',
      coverImage: 'https://s3.amazonaws.com/99Covers-Facebook-Covers/watermark/14238.jpg',
      ecdh: '',
      group: false,
      idcommitment: '',
      joinedAt: 1644251733000,
      joinedTx: '0x9e532171096cf4f4fe68cd384addf3baaf31644c48506cb4550efb586a165c5a',
      meta: {
        acceptanceReceived: null,
        acceptanceSent: null,
        blocked: null,
        blockedCount: 0,
        blockingCount: 0,
        followed:
          '0x3F425586D68616A113C29c303766DAD444167EE8/6cb3a3eea1355ead9cbcb0907e282eac3d1f606d7a8d77252445404a09d58584',
        followerCount: 4,
        followingCount: 4,
        inviteReceived: null,
        inviteSent: null,
        mentionedCount: 2,
        postingCount: 22,
      },
      name: 'yagamilight',
      profileImage: 'https://i1.sndcdn.com/artworks-000452560338-e3uzc2-t500x500.jpg',
      pubkey:
        'dBgXJATrP4KeE6zfuR4_arauMIeT_86MrQg6JbbnuxM.yJXykCW6qjB54B29by8vIWoMwk8T5NG_3awHdKC9Bgc',
      twitterVerification: 'https://twitter.com/0xTsukino/status/1465332814937690114',
      type: 'arbitrum',
      username: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
      website: '',
    },
    'should return user by name'
  );

  // @ts-expect-error
  const { createdAt, updatedAt, ...user2 } = await db.users!.findOneByPubkey(
    'MNw7njaTh0k835aq0JKtmpq33izkGwFxdldqf3txB64.a-yzwTFi1hNP-4lrpHB5NAw7p100oAOUefpYwfLPer8'
  );
  t.deepEqual(
    user2,
    {
      joinedAt: '1644254074000',
      name: '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb',
      pubkey:
        'MNw7njaTh0k835aq0JKtmpq33izkGwFxdldqf3txB64.a-yzwTFi1hNP-4lrpHB5NAw7p100oAOUefpYwfLPer8',
      tx: '0xfde1d05921ccb073f71b747fd323fa313d51c77db82311993555692881ff9387',
      type: 'arbitrum',
    },
    'should return user by pubkey'
  );

  const user3 = await db.users!.readAll('0x3F425586D68616A113C29c303766DAD444167EE8', 0, 5);
  t.deepEqual(
    user3,
    [
      {
        address: '0x09581b207F27b3E941D62d353194543d38182651',
        bio: '',
        coverImage: '',
        ecdh: '',
        group: false,
        idcommitment: '',
        joinedAt: 1645743703000,
        joinedTx: '0xa78e8c2e65ba073b29fbcb136b8f262c60464a3413ad6759d4cf41426573f35d',
        meta: {
          acceptanceReceived: null,
          acceptanceSent: null,
          blocked: null,
          blockedCount: 1,
          blockingCount: 0,
          followed: null,
          followerCount: 0,
          followingCount: 0,
          inviteReceived: null,
          inviteSent: null,
          mentionedCount: 0,
          postingCount: 0,
        },
        name: '',
        profileImage: '',
        pubkey:
          'INXAI0WyuO24U2fdeN_m70gqLx2CXm49kKT_Mx3R6Cw.Uya6GtBfuHfrHR4Lkc8_BiN2HPFpQ_1Yr95S-AomGiM',
        twitterVerification: '',
        type: 'arbitrum',
        username: '0x09581b207F27b3E941D62d353194543d38182651',
        website: '',
      },
      {
        address: '0x5d432ce201d2c03234e314d4703559102Ebf365C',
        bio: '',
        coverImage:
          'https://imagesvc.meredithcorp.io/v3/mm/image?q=85&c=sc&poi=face&w=2000&h=1000&url=https%3A%2F%2Fstatic.onecms.io%2Fwp-content%2Fuploads%2Fsites%2F6%2F2017%2F07%2Fmr-poopybutthole-season-2-episode-4-2000.jpg',
        ecdh: '',
        group: false,
        idcommitment: '',
        joinedAt: 1647991582000,
        joinedTx: '0x4522e7854fba0bafeadbe93f4242290699b0f47dc43b119148636c6c69506d3b',
        meta: {
          acceptanceReceived: null,
          acceptanceSent: null,
          blocked: null,
          blockedCount: 0,
          blockingCount: 0,
          followed: null,
          followerCount: 1,
          followingCount: 1,
          inviteReceived: null,
          inviteSent: null,
          mentionedCount: 2,
          postingCount: 0,
        },
        name: 'Mr.Poopybutthole',
        profileImage:
          'https://hips.hearstapps.com/hmg-prod.s3.amazonaws.com/images/rick-and-morty-poopybuthole-1574420029.jpg?crop=0.704xw:1.00xh;0,0&resize=480:*',
        pubkey:
          'ohfgrR0yWExZj-zxb_dXLgL2q4WcqfUWjLpD9kpMSjc.odeQ30shx28Dscix1Ywfw0o1ofLgU0qJ8-URAr2xTeA',
        twitterVerification: '',
        type: 'arbitrum',
        username: '0x5d432ce201d2c03234e314d4703559102Ebf365C',
        website: '',
      },
      {
        address: '0x3aec555a667EF810C4B0a0D064D6Fb7c66161360',
        bio: '',
        coverImage: '',
        ecdh: '',
        group: false,
        idcommitment: '',
        joinedAt: 1648086605000,
        joinedTx: '0x0024f0472ec847e220d664202e37c4c2588df48c7d7a631d73f71dc23c33019c',
        meta: {
          acceptanceReceived: null,
          acceptanceSent: null,
          blocked: null,
          blockedCount: 0,
          blockingCount: 0,
          followed: null,
          followerCount: 0,
          followingCount: 0,
          inviteReceived: null,
          inviteSent: null,
          mentionedCount: 2,
          postingCount: 2,
        },
        name: 'kanna chan',
        profileImage: 'https://media3.giphy.com/media/WcEvIajIk332g/giphy.gif',
        pubkey:
          'gxQnqpLxu8E74yn4t0N5mCoaE7MfRxEg8LiSGoBpMMw.Hkk05CtLQZEVTorgPVEYj97PHBnK-atlOdixjvF0Kn4',
        twitterVerification: '',
        type: 'arbitrum',
        username: '0x3aec555a667EF810C4B0a0D064D6Fb7c66161360',
        website: '',
      },
      {
        address: '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63',
        bio: '',
        coverImage: '',
        ecdh: '',
        group: false,
        idcommitment: '',
        joinedAt: 1647393506000,
        joinedTx: '0xc35bd6dbbeec827b2b6cccc1acaae032e6e9a0ebb190ba5d7c276d7c6cce0fc6',
        meta: {
          acceptanceReceived: null,
          acceptanceSent: null,
          blocked: null,
          blockedCount: 0,
          blockingCount: 1,
          followed: null,
          followerCount: 1,
          followingCount: 2,
          inviteReceived: null,
          inviteSent: null,
          mentionedCount: 3,
          postingCount: 5,
        },
        name: '0xFEBc',
        profileImage: '',
        pubkey:
          'z-CGdwpcNR39Ib3j_uTnAVtEoWyCuhMIXhZijh272lo.3KcFAl0dkDzuAGj54PUVq1fpJzVpGlFeuTf3j8NabUI',
        twitterVerification: '',
        type: 'arbitrum',
        username: '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63',
        website: '',
      },
      {
        address: '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb',
        bio: '',
        coverImage: '',
        ecdh: '',
        group: false,
        idcommitment: '',
        joinedAt: 1644254074000,
        joinedTx: '0xfde1d05921ccb073f71b747fd323fa313d51c77db82311993555692881ff9387',
        meta: {
          acceptanceReceived: null,
          acceptanceSent: null,
          blocked: null,
          blockedCount: 0,
          blockingCount: 0,
          followed: null,
          followerCount: 2,
          followingCount: 3,
          inviteReceived: null,
          inviteSent: null,
          mentionedCount: 2,
          postingCount: 7,
        },
        name: 'Ohwee',
        profileImage: '',
        pubkey:
          'MNw7njaTh0k835aq0JKtmpq33izkGwFxdldqf3txB64.a-yzwTFi1hNP-4lrpHB5NAw7p100oAOUefpYwfLPer8',
        twitterVerification: '',
        type: 'arbitrum',
        username: '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb',
        website: '',
      },
    ],
    'should return all users'
  );

  const user4 = await db.users!.search('yaga', '0x3F425586D68616A113C29c303766DAD444167EE8', 0, 2);
  t.deepEqual(
    user4,
    [
      {
        address: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
        bio: '',
        coverImage: 'https://s3.amazonaws.com/99Covers-Facebook-Covers/watermark/14238.jpg',
        ecdh: '',
        group: false,
        idcommitment: '',
        joinedAt: 1644251733000,
        joinedTx: '0x9e532171096cf4f4fe68cd384addf3baaf31644c48506cb4550efb586a165c5a',
        meta: {
          acceptanceReceived: null,
          acceptanceSent: null,
          blocked: null,
          blockedCount: 0,
          blockingCount: 0,
          followed:
            '0x3F425586D68616A113C29c303766DAD444167EE8/6cb3a3eea1355ead9cbcb0907e282eac3d1f606d7a8d77252445404a09d58584',
          followerCount: 4,
          followingCount: 4,
          inviteReceived: null,
          inviteSent: null,
          mentionedCount: 2,
          postingCount: 22,
        },
        name: 'yagamilight',
        profileImage: 'https://i1.sndcdn.com/artworks-000452560338-e3uzc2-t500x500.jpg',
        pubkey:
          'dBgXJATrP4KeE6zfuR4_arauMIeT_86MrQg6JbbnuxM.yJXykCW6qjB54B29by8vIWoMwk8T5NG_3awHdKC9Bgc',
        twitterVerification: 'https://twitter.com/0xTsukino/status/1465332814937690114',
        type: 'arbitrum',
        username: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
        website: '',
      },
    ],
    'should search user by name'
  );

  let searchResults = await db.posts!.search('test', 0, 100);
  t.equal(searchResults.length, 42, 'should search post by text content');

  searchResults = await db.posts!.search('test|asdf', 0, 100);
  t.equal(searchResults.length, 45, 'should search post by text content');

  searchResults = await db.posts!.search('test,asdf', 0, 100);
  t.equal(searchResults.length, 45, 'should search post by text content');

  searchResults = await db.posts!.search('test||asdf', 0, 100);
  t.equal(searchResults.length, 45, 'should search post by text content');

  await db.stop();
  t.end();
});
