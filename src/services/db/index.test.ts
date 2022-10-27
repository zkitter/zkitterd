import fs from 'fs';
import path from 'path';
import tape from 'tape';

import DBService from './index';
import { getMockDB } from '../../util/test';

const gunpath = path.join(process.cwd(), 'gun.test.db');

if (fs.existsSync(gunpath)) fs.unlinkSync(gunpath);

tape('DBService', async t => {
  const db = await getMockDB();

  t.equal(db.app, await db.getApp());
  t.equal(db.records, await db.getRecords());
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
  t.equal(db.interepGroups, await db.getInterepGroups());
  t.equal(db.semaphoreCreators, await db.getSemaphoreCreators());
  t.equal(db.threads, await db.getThreads());

  // @ts-ignore
  const { id, createdAt, updatedAt, ...appData } = await db.app?.read();
  t.deepEqual(
    appData,
    {
      lastArbitrumBlockScanned: 2193241,
      lastENSBlockScanned: 12957300,
      lastInterrepBlockScanned: 28311377,
      lastGroup42BlockScanned: 7660170,
    },
    'should read and write app'
  );

  // @ts-ignore
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

  const ig1 = await db.interepGroups!.findOneByHash(
    '12610260130062152224897807626844050096295734347810798823127924471851444645999'
  );
  t.deepEqual(ig1!.name, 'not_sufficient', 'should return interep group by hash');

  const link1 = await db.linkPreview!.read(
    'https://c.tenor.com/G1DmbkkM46cAAAAC/eimi-fukada-eimi-dance.gif'
  );
  t.deepEqual(link1!.contentType, 'image/gif', 'should return link by url');

  const meta1 = await db.meta!.findOne(
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/8f7e627373283807338846710c7a9ab3484e295127bc0c4d19f58829b4bbe195'
  );
  t.deepEqual(
    meta1,
    { liked: null, reposted: null, replyCount: 0, repostCount: 0, likeCount: 1, postCount: 0 },
    'should return meta by message id'
  );

  t.deepEqual(
    await db.meta!.findTags(),
    [
      { tagName: '#TODO', postCount: 9 },
      { tagName: '#test', postCount: 6 },
      { tagName: '#autism', postCount: 2 },
      { tagName: '#bug', postCount: 1 },
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
    { liked: null, reposted: null, replyCount: 0, repostCount: 0, likeCount: 2, postCount: 0 },
    'should add post counts'
  );

  // @ts-ignore
  const { updatedAt, ...mod1 } = await db.moderations!.findOne(
    '8f24b1ae868cbc87a509dbba582af6e396460237b88ad9f09644fa65e44deed9'
  );
  t.deepEqual(
    mod1,
    {
      messageId:
        '0x3F425586D68616A113C29c303766DAD444167EE8/8f24b1ae868cbc87a509dbba582af6e396460237b88ad9f09644fa65e44deed9',
      hash: '8f24b1ae868cbc87a509dbba582af6e396460237b88ad9f09644fa65e44deed9',
      creator: '0x3F425586D68616A113C29c303766DAD444167EE8',
      type: 'MODERATION',
      subtype: 'LIKE',
      createdAt: '1646285327701',
      reference: '945bb091bfadd460418c36ce6274d6a4f9689aaca1b95879ffe35ca7a4eded5b',
    },
    'should return one moderation'
  );

  // @ts-ignore
  const [{ updatedAt, ...mod2 }] = await db.moderations!.findThreadModeration(
    '0x3F425586D68616A113C29c303766DAD444167EE8/d3f9955efd39a068b1b1482040c9ff6d429263987282ced9e296c07dc8e0126c'
  );
  t.deepEqual(
    mod2,
    {
      messageId:
        '0x3F425586D68616A113C29c303766DAD444167EE8/691336cb1993b3f689414a415bfe7ddf84e7fcb4c4a439cf7cc299878676cfd8',
      creator: '0x3F425586D68616A113C29c303766DAD444167EE8',
      reference:
        '0x3F425586D68616A113C29c303766DAD444167EE8/d3f9955efd39a068b1b1482040c9ff6d429263987282ced9e296c07dc8e0126c',
      type: 'MODERATION',
      subtype: 'THREAD_ONLY_MENTION',
      hash: '691336cb1993b3f689414a415bfe7ddf84e7fcb4c4a439cf7cc299878676cfd8',
      createdAt: '1648193705500',
    },
    'should return thread moderation'
  );

  // @ts-ignore
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

  // @ts-ignore
  const post1 = await db.posts!.findRoot(
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/1b18998ef35ecbb35760e71f6531f75912f79a9162eadfae90bb4e8740aa132b'
  );
  t.deepEqual(
    post1,
    '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
    'should return root'
  );

  // @ts-ignore
  const post2 = await db.posts!.findOne(
    'd0b437c184c3600f0e87921957e352dac895da11110e94f68985d9a5b38f3f9b',
    '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb'
  );
  t.deepEqual(
    post2,
    {
      type: 'POST',
      subtype: 'M_POST',
      messageId:
        '0x3F425586D68616A113C29c303766DAD444167EE8/d0b437c184c3600f0e87921957e352dac895da11110e94f68985d9a5b38f3f9b',
      hash: 'd0b437c184c3600f0e87921957e352dac895da11110e94f68985d9a5b38f3f9b',
      createdAt: '1648193678747',
      payload: {
        topic: 'https://twitter.com/AutismDev/status/1507259650093182977',
        title: '',
        content:
          '@0x3aec555a667EF810C4B0a0D064D6Fb7c66161360 @0x5d432ce201d2c03234e314d4703559102Ebf365C @0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb ',
        reference: '',
        attachment: '',
      },
      meta: {
        replyCount: 0,
        likeCount: 0,
        repostCount: 0,
        liked: null,
        reposted: null,
        blocked: null,
        interepProvider: null,
        interepGroup: null,
        rootId:
          '0x3F425586D68616A113C29c303766DAD444167EE8/d0b437c184c3600f0e87921957e352dac895da11110e94f68985d9a5b38f3f9b',
        moderation: 'THREAD_ONLY_MENTION',
        modblockedctx: null,
        modfollowedctx: null,
        modmentionedctx:
          '0x3F425586D68616A113C29c303766DAD444167EE8/d0b437c184c3600f0e87921957e352dac895da11110e94f68985d9a5b38f3f9b',
        modLikedPost: null,
        modBlockedPost: null,
        modBlockedUser: null,
        modFollowerUser: null,
      },
    },
    'should return post'
  );

  // @ts-ignore
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
        type: 'POST',
        subtype: 'M_POST',
        messageId:
          '0x3F425586D68616A113C29c303766DAD444167EE8/1bd96ba61f182f1619668040f8845a36d230dda686f8c8e7b8502568dac18e95',
        hash: '1bd96ba61f182f1619668040f8845a36d230dda686f8c8e7b8502568dac18e95',
        createdAt: '1648192630248',
        payload: {
          topic: 'https://twitter.com/AutismDev/status/1507255252461842438',
          title: '',
          content: 'asdfasdfasdfasd asdfasdf asdfasdf',
          reference: '',
          attachment: '',
        },
        meta: {
          replyCount: 0,
          likeCount: 0,
          repostCount: 0,
          liked: null,
          reposted: null,
          blocked: null,
          interepProvider: null,
          interepGroup: null,
          rootId:
            '0x3F425586D68616A113C29c303766DAD444167EE8/1bd96ba61f182f1619668040f8845a36d230dda686f8c8e7b8502568dac18e95',
          moderation: null,
          modblockedctx: null,
          modfollowedctx:
            '0x3F425586D68616A113C29c303766DAD444167EE8/6cb3a3eea1355ead9cbcb0907e282eac3d1f606d7a8d77252445404a09d58584',
          modmentionedctx: null,
          modLikedPost: null,
          modBlockedPost: null,
          modBlockedUser: null,
          modFollowerUser: null,
        },
      },
      {
        type: 'POST',
        subtype: '',
        messageId: 'db51fd8dd7d710c56ef9cca92ee3bc1e332d029f78a67f09d22087a2ac3be038',
        hash: 'db51fd8dd7d710c56ef9cca92ee3bc1e332d029f78a67f09d22087a2ac3be038',
        createdAt: '1648192605180',
        payload: {
          topic: '',
          title: '',
          content: 'asdfasdf',
          reference: '',
          attachment: '',
        },
        meta: {
          replyCount: 0,
          likeCount: 0,
          repostCount: 0,
          liked: null,
          reposted: null,
          blocked: null,
          interepProvider: 'twitter',
          interepGroup: 'not_sufficient',
          rootId: 'db51fd8dd7d710c56ef9cca92ee3bc1e332d029f78a67f09d22087a2ac3be038',
          moderation: null,
          modblockedctx: null,
          modfollowedctx: null,
          modmentionedctx: null,
          modLikedPost: null,
          modBlockedPost: null,
          modBlockedUser: null,
          modFollowerUser: null,
        },
      },
      {
        type: 'POST',
        subtype: '',
        messageId: '6c62eb251be69ca722e5a615f616ce68b6ad3378b4568c93e34cad455905cc9a',
        hash: '6c62eb251be69ca722e5a615f616ce68b6ad3378b4568c93e34cad455905cc9a',
        createdAt: '1648093704735',
        payload: {
          topic: '',
          title: '',
          content: '',
          reference: '',
          attachment: 'https://c.tenor.com/G1DmbkkM46cAAAAC/eimi-fukada-eimi-dance.gif',
        },
        meta: {
          replyCount: 1,
          likeCount: 0,
          repostCount: 0,
          liked: null,
          reposted: null,
          blocked: null,
          interepProvider: 'twitter',
          interepGroup: 'not_sufficient',
          rootId: '6c62eb251be69ca722e5a615f616ce68b6ad3378b4568c93e34cad455905cc9a',
          moderation: null,
          modblockedctx: null,
          modfollowedctx: null,
          modmentionedctx: null,
          modLikedPost: null,
          modBlockedPost: null,
          modBlockedUser: null,
          modFollowerUser: null,
        },
      },
      {
        type: 'POST',
        subtype: '',
        messageId:
          '0x3aec555a667EF810C4B0a0D064D6Fb7c66161360/899e3621100ce2d3411431ca777cea7fa0223fccec9ab073181bd7ee65a64456',
        hash: '899e3621100ce2d3411431ca777cea7fa0223fccec9ab073181bd7ee65a64456',
        createdAt: '1648093364657',
        payload: {
          topic: '',
          title: '',
          content: 'gm everyone',
          reference: '',
          attachment: '',
        },
        meta: {
          replyCount: 0,
          likeCount: 1,
          repostCount: 0,
          liked:
            '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/3ae9158b74ff7cd02a5638d751a605dd9e930b1201a167d498eabd0f0c331692',
          reposted: null,
          blocked: null,
          interepProvider: null,
          interepGroup: null,
          rootId:
            '0x3aec555a667EF810C4B0a0D064D6Fb7c66161360/899e3621100ce2d3411431ca777cea7fa0223fccec9ab073181bd7ee65a64456',
          moderation: null,
          modblockedctx: null,
          modfollowedctx: null,
          modmentionedctx: null,
          modLikedPost: null,
          modBlockedPost: null,
          modBlockedUser: null,
          modFollowerUser: null,
        },
      },
      {
        type: 'POST',
        subtype: '',
        messageId:
          '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/ca8462e60519167046ce106caca1c45c21bf7b198f2c29c2ee802dbb5c32ed6e',
        hash: 'ca8462e60519167046ce106caca1c45c21bf7b198f2c29c2ee802dbb5c32ed6e',
        createdAt: '1648001768213',
        payload: {
          topic: '',
          title: '',
          content: '#TODO PWA-ify mobile view',
          reference: '',
          attachment: '',
        },
        meta: {
          replyCount: 0,
          likeCount: 1,
          repostCount: 0,
          liked: null,
          reposted: null,
          blocked: null,
          interepProvider: null,
          interepGroup: null,
          rootId:
            '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/ca8462e60519167046ce106caca1c45c21bf7b198f2c29c2ee802dbb5c32ed6e',
          moderation: null,
          modblockedctx: null,
          modfollowedctx: null,
          modmentionedctx: null,
          modLikedPost: null,
          modBlockedPost: null,
          modBlockedUser: null,
          modFollowerUser: null,
        },
      },
    ],
    'should return all posts'
  );

  // @ts-ignore
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
        type: 'POST',
        subtype: 'REPLY',
        messageId:
          '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/bdbcc91d89ad6953c90585641766f41554be6ed19b57389e42056a4a2f876f2a',
        hash: 'bdbcc91d89ad6953c90585641766f41554be6ed19b57389e42056a4a2f876f2a',
        createdAt: '1647989094705',
        payload: {
          topic: '',
          title: '',
          content: '#test',
          reference:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/f0579814819379c975b732309aa52505ba55747a56fb1bb587e77929bfa8d2e5',
          attachment: '',
        },
        meta: {
          replyCount: 0,
          likeCount: 0,
          repostCount: 0,
          liked: null,
          reposted: null,
          blocked: null,
          interepProvider: null,
          interepGroup: null,
          rootId:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/f0579814819379c975b732309aa52505ba55747a56fb1bb587e77929bfa8d2e5',
          moderation: null,
          modblockedctx: null,
          modfollowedctx:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/2b002393948d0b27fd8d4ef2b8da12b966d5dcac113badeb616c076b07046f7a',
          modmentionedctx: null,
          modLikedPost: null,
          modBlockedPost: null,
          modBlockedUser: null,
          modFollowerUser:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/2b002393948d0b27fd8d4ef2b8da12b966d5dcac113badeb616c076b07046f7a',
        },
      },
      {
        type: 'POST',
        subtype: 'REPLY',
        messageId:
          '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/b645028d763c0564e89d58d000e4844eed66358e51ecdb84d2f7f2a5864d2292',
        hash: 'b645028d763c0564e89d58d000e4844eed66358e51ecdb84d2f7f2a5864d2292',
        createdAt: '1647579193827',
        payload: {
          topic: '',
          title: '',
          content: 'teest asdfasdf ',
          reference:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
          attachment: '',
        },
        meta: {
          replyCount: 0,
          likeCount: 1,
          repostCount: 0,
          liked: null,
          reposted: null,
          blocked: null,
          interepProvider: null,
          interepGroup: null,
          rootId:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
          moderation: 'THREAD_ONLY_MENTION',
          modblockedctx: null,
          modfollowedctx:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/23fbb7d13fcb649bba8e0fbd8f5fb830df8bf35e08ab5134544fd5731ef21543',
          modmentionedctx: null,
          modLikedPost:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/4a20a1924dd087e348e2bfa1cc5827300e471687b9e5b631cc27453c715310a2',
          modBlockedPost: null,
          modBlockedUser: null,
          modFollowerUser:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/23fbb7d13fcb649bba8e0fbd8f5fb830df8bf35e08ab5134544fd5731ef21543',
        },
      },
    ],
    'should return replies from creator'
  );

  // @ts-ignore
  const post5 = await db.posts!.getHomeFeed('0xd44a82dD160217d46D754a03C8f841edF06EBE3c', 2, 2);
  t.deepEqual(
    post5,
    [
      {
        type: 'POST',
        subtype: 'M_POST',
        messageId:
          '0x3F425586D68616A113C29c303766DAD444167EE8/d0b437c184c3600f0e87921957e352dac895da11110e94f68985d9a5b38f3f9b',
        hash: 'd0b437c184c3600f0e87921957e352dac895da11110e94f68985d9a5b38f3f9b',
        createdAt: '1648193678747',
        payload: {
          topic: 'https://twitter.com/AutismDev/status/1507259650093182977',
          title: '',
          content:
            '@0x3aec555a667EF810C4B0a0D064D6Fb7c66161360 @0x5d432ce201d2c03234e314d4703559102Ebf365C @0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb ',
          reference: '',
          attachment: '',
        },
        meta: {
          replyCount: 0,
          likeCount: 0,
          repostCount: 0,
          liked: null,
          reposted: null,
          blocked: null,
          interepProvider: null,
          interepGroup: null,
          rootId:
            '0x3F425586D68616A113C29c303766DAD444167EE8/d0b437c184c3600f0e87921957e352dac895da11110e94f68985d9a5b38f3f9b',
          moderation: 'THREAD_ONLY_MENTION',
          modblockedctx: null,
          modfollowedctx:
            '0x3F425586D68616A113C29c303766DAD444167EE8/6cb3a3eea1355ead9cbcb0907e282eac3d1f606d7a8d77252445404a09d58584',
          modmentionedctx: null,
          modLikedPost: null,
          modBlockedPost: null,
          modBlockedUser: null,
          modFollowerUser: null,
        },
      },
      {
        type: 'POST',
        subtype: 'M_POST',
        messageId:
          '0x3F425586D68616A113C29c303766DAD444167EE8/1bd96ba61f182f1619668040f8845a36d230dda686f8c8e7b8502568dac18e95',
        hash: '1bd96ba61f182f1619668040f8845a36d230dda686f8c8e7b8502568dac18e95',
        createdAt: '1648192630248',
        payload: {
          topic: 'https://twitter.com/AutismDev/status/1507255252461842438',
          title: '',
          content: 'asdfasdfasdfasd asdfasdf asdfasdf',
          reference: '',
          attachment: '',
        },
        meta: {
          replyCount: 0,
          likeCount: 0,
          repostCount: 0,
          liked: null,
          reposted: null,
          blocked: null,
          interepProvider: null,
          interepGroup: null,
          rootId:
            '0x3F425586D68616A113C29c303766DAD444167EE8/1bd96ba61f182f1619668040f8845a36d230dda686f8c8e7b8502568dac18e95',
          moderation: null,
          modblockedctx: null,
          modfollowedctx:
            '0x3F425586D68616A113C29c303766DAD444167EE8/6cb3a3eea1355ead9cbcb0907e282eac3d1f606d7a8d77252445404a09d58584',
          modmentionedctx: null,
          modLikedPost: null,
          modBlockedPost: null,
          modBlockedUser: null,
          modFollowerUser: null,
        },
      },
    ],
    'should return home feed'
  );

  // @ts-ignore
  const post6 = await db.posts!.findAllReplies(
    '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c'
  );
  t.deepEqual(
    post6,
    [
      {
        type: 'POST',
        subtype: 'REPLY',
        messageId:
          '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/699a260463efd7d6173a4af8fae4bc8b7d62fa1a3e13bcff8ba3de652d676b82',
        hash: '699a260463efd7d6173a4af8fae4bc8b7d62fa1a3e13bcff8ba3de652d676b82',
        createdAt: '1647564670980',
        payload: {
          topic: '',
          title: '',
          content: 'asdfa',
          reference:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
          attachment: '',
        },
        meta: {
          replyCount: 1,
          likeCount: 0,
          repostCount: 0,
          liked: null,
          reposted: null,
          blocked: null,
          interepProvider: null,
          interepGroup: null,
          rootId:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
          moderation: 'THREAD_ONLY_MENTION',
          modblockedctx: null,
          modfollowedctx:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/23fbb7d13fcb649bba8e0fbd8f5fb830df8bf35e08ab5134544fd5731ef21543',
          modmentionedctx: null,
          modLikedPost: null,
          modBlockedPost: null,
          modBlockedUser: null,
          modFollowerUser: null,
        },
      },
      {
        type: 'POST',
        subtype: 'REPLY',
        messageId:
          '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/b645028d763c0564e89d58d000e4844eed66358e51ecdb84d2f7f2a5864d2292',
        hash: 'b645028d763c0564e89d58d000e4844eed66358e51ecdb84d2f7f2a5864d2292',
        createdAt: '1647579193827',
        payload: {
          topic: '',
          title: '',
          content: 'teest asdfasdf ',
          reference:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
          attachment: '',
        },
        meta: {
          replyCount: 0,
          likeCount: 1,
          repostCount: 0,
          liked: null,
          reposted: null,
          blocked: null,
          interepProvider: null,
          interepGroup: null,
          rootId:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
          moderation: 'THREAD_ONLY_MENTION',
          modblockedctx: null,
          modfollowedctx:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/23fbb7d13fcb649bba8e0fbd8f5fb830df8bf35e08ab5134544fd5731ef21543',
          modmentionedctx: null,
          modLikedPost:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/4a20a1924dd087e348e2bfa1cc5827300e471687b9e5b631cc27453c715310a2',
          modBlockedPost: null,
          modBlockedUser: null,
          modFollowerUser:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/23fbb7d13fcb649bba8e0fbd8f5fb830df8bf35e08ab5134544fd5731ef21543',
        },
      },
    ],
    'should return all replies of a ref'
  );

  // @ts-ignore
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
        type: 'POST',
        subtype: 'REPLY',
        messageId:
          '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/b645028d763c0564e89d58d000e4844eed66358e51ecdb84d2f7f2a5864d2292',
        hash: 'b645028d763c0564e89d58d000e4844eed66358e51ecdb84d2f7f2a5864d2292',
        createdAt: '1647579193827',
        payload: {
          topic: '',
          title: '',
          content: 'teest asdfasdf ',
          reference:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
          attachment: '',
        },
        meta: {
          replyCount: 0,
          likeCount: 1,
          repostCount: 0,
          liked:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/4a20a1924dd087e348e2bfa1cc5827300e471687b9e5b631cc27453c715310a2',
          reposted: null,
          blocked: null,
          interepProvider: null,
          interepGroup: null,
          rootId:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
          moderation: 'THREAD_ONLY_MENTION',
          modblockedctx: null,
          modfollowedctx: null,
          modmentionedctx: null,
          modLikedPost:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/4a20a1924dd087e348e2bfa1cc5827300e471687b9e5b631cc27453c715310a2',
          modBlockedPost: null,
          modBlockedUser: null,
          modFollowerUser:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/23fbb7d13fcb649bba8e0fbd8f5fb830df8bf35e08ab5134544fd5731ef21543',
        },
      },
      {
        type: 'POST',
        subtype: 'REPLY',
        messageId:
          '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/1b18998ef35ecbb35760e71f6531f75912f79a9162eadfae90bb4e8740aa132b',
        hash: '1b18998ef35ecbb35760e71f6531f75912f79a9162eadfae90bb4e8740aa132b',
        createdAt: '1647579176008',
        payload: {
          topic: '',
          title: '',
          content: 'test',
          reference:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/699a260463efd7d6173a4af8fae4bc8b7d62fa1a3e13bcff8ba3de652d676b82',
          attachment: '',
        },
        meta: {
          replyCount: 0,
          likeCount: 1,
          repostCount: 0,
          liked:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/086e741d1ad02c278e79ac8fc03d0dc9f886f1b00d10edffb4c21997b00c1352',
          reposted: null,
          blocked: null,
          interepProvider: null,
          interepGroup: null,
          rootId:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/0de45d68f3ba31eb59b504a8a36266724fb104f865f55da662268b1caf0db58f',
          moderation: 'THREAD_ONLY_MENTION',
          modblockedctx: null,
          modfollowedctx: null,
          modmentionedctx: null,
          modLikedPost:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/086e741d1ad02c278e79ac8fc03d0dc9f886f1b00d10edffb4c21997b00c1352',
          modBlockedPost: null,
          modBlockedUser: null,
          modFollowerUser:
            '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/23fbb7d13fcb649bba8e0fbd8f5fb830df8bf35e08ab5134544fd5731ef21543',
        },
      },
    ],
    'should return all liked posts by a user'
  );

  // @ts-ignore
  const { updatedAt, ...profile1 } = await db.profiles!.findOne(
    '8118b718d403045f3632c5a7f811676b5b6ff51477383758b630e380b34ba1a3'
  );
  t.deepEqual(
    profile1,
    {
      messageId:
        '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/8118b718d403045f3632c5a7f811676b5b6ff51477383758b630e380b34ba1a3',
      hash: '8118b718d403045f3632c5a7f811676b5b6ff51477383758b630e380b34ba1a3',
      creator: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
      type: 'PROFILE',
      subtype: 'NAME',
      createdAt: '1634053438409',
      key: '',
      value: '夜神 月',
    },
    'should return profile'
  );

  await db.posts!.createTwitterPosts([
    {
      type: '@TWEET@',
      messageId: 'testid',
      hash: 'testhash',
      subtype: '',
      content: 'Hello World,',
      creator: '',
      createdAt: 1,
      topic: '',
      title: '',
      reference: 'testref',
      attachment: '',
    },
  ]);

  // @ts-ignore
  const { updatedAt, ...post8 } = await db.posts!.findLastTweetInConversation('testref');
  t.deepEqual(
    post8,
    {
      hash: 'testhash',
      messageId: 'testid',
      creator: '',
      proof: null,
      signals: null,
      type: '@TWEET@',
      subtype: '',
      createdAt: '1',
      topic: '',
      title: '',
      content: 'Hello World,',
      reference: 'testref',
      attachment: '',
    },
    'should return last tweet replies in a thread'
  );

  await db.posts!.ensurePost('0xcreator/testensureid');
  await db.posts!.createPost({
    messageId: '0xcreator/testensureid',
    hash: 'testensureid',
    content: 'hello create post!',
    creator: '0xcreator',
    type: 'POST',
    subtype: '',
    topic: '',
    title: '',
    attachment: '',
    reference: '',
    createdAt: 1,
  });

  // @ts-ignore
  const post9 = await db.posts!.findOne('testensureid');
  t.deepEqual(
    post9,
    {
      type: 'POST',
      subtype: '',
      messageId: '0xcreator/testensureid',
      hash: 'testensureid',
      createdAt: '1',
      payload: {
        topic: '',
        title: '',
        content: 'hello create post!',
        reference: '',
        attachment: '',
      },
      meta: {
        replyCount: 0,
        likeCount: 0,
        repostCount: 0,
        liked: null,
        reposted: null,
        blocked: null,
        interepProvider: null,
        interepGroup: null,
        rootId: null,
        moderation: null,
        modblockedctx: null,
        modfollowedctx: null,
        modmentionedctx: null,
        modLikedPost: null,
        modBlockedPost: null,
        modBlockedUser: null,
        modFollowerUser: null,
      },
    },
    'should return created post'
  );

  await db.records!.updateOrCreateRecord({
    soul: '#soul',
    field: '!field',
    value: '@value',
    relation: '~relation',
    state: 1,
  });

  await db.records!.updateOrCreateRecord({
    soul: '#soul2',
    field: '!field2',
    value: '@value2',
    relation: '~relation2',
    state: 2,
  });

  // @ts-ignore
  const { updatedAt, createdAt, ...record1 } = await db.records!.findOne('#soul', '!field');
  t.deepEqual(
    record1,
    { id: 1, soul: '#soul', field: '!field', value: '@value', relation: '~relation', state: 1 },
    'should return one record'
  );

  // @ts-ignore
  const record2 = await db.records!.findAll('#soul');
  t.deepEqual(record2[0].value, '@value', 'should return all records of a sould');

  // @ts-ignore
  const record3 = await db.records!.readAll();
  t.deepEqual(
    record3.map(d => d.value),
    ['@value', '@value2'],
    'should return all records'
  );

  // // @ts-ignore
  // const sema1 = await db.semaphore!.findOneByCommitment('11478604443530795445406842905228486956674818902660313591870165575138495663261');
  // t.deepEqual(
  //     sema1!.provider,
  //     'twitter',
  //     'should return one semaphore row',
  // );

  // @ts-ignore
  const sema2 = await db.semaphore!.findAllByCommitment(
    '11478604443530795445406842905228486956674818902660313591870165575138495663261'
  );
  t.deepEqual(
    sema2.map(d => d.id_commitment),
    ['11478604443530795445406842905228486956674818902660313591870165575138495663261'],
    'should return all semaphore rows'
  );

  // @ts-ignore
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
        type: 'POST',
        subtype: 'REPLY',
        messageId:
          '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/bdbcc91d89ad6953c90585641766f41554be6ed19b57389e42056a4a2f876f2a',
        hash: 'bdbcc91d89ad6953c90585641766f41554be6ed19b57389e42056a4a2f876f2a',
        createdAt: '1647989094705',
        payload: {
          topic: '',
          title: '',
          content: '#test',
          reference:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/f0579814819379c975b732309aa52505ba55747a56fb1bb587e77929bfa8d2e5',
          attachment: '',
        },
        meta: {
          replyCount: 0,
          likeCount: 0,
          repostCount: 0,
          liked: null,
          reposted: null,
          blocked: null,
          interepProvider: null,
          interepGroup: null,
          rootId:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/f0579814819379c975b732309aa52505ba55747a56fb1bb587e77929bfa8d2e5',
          moderation: null,
          modblockedctx: null,
          modfollowedctx:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/2b002393948d0b27fd8d4ef2b8da12b966d5dcac113badeb616c076b07046f7a',
          modmentionedctx: null,
          modLikedPost: null,
          modBlockedPost: null,
          modBlockedUser: null,
          modFollowerUser:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/2b002393948d0b27fd8d4ef2b8da12b966d5dcac113badeb616c076b07046f7a',
        },
      },
      {
        type: 'POST',
        subtype: '',
        messageId:
          '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/f0579814819379c975b732309aa52505ba55747a56fb1bb587e77929bfa8d2e5',
        hash: 'f0579814819379c975b732309aa52505ba55747a56fb1bb587e77929bfa8d2e5',
        createdAt: '1647989013660',
        payload: { topic: '', title: '', content: 'test #test', reference: '', attachment: '' },
        meta: {
          replyCount: 3,
          likeCount: 0,
          repostCount: 0,
          liked: null,
          reposted: null,
          blocked: null,
          interepProvider: null,
          interepGroup: null,
          rootId:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/f0579814819379c975b732309aa52505ba55747a56fb1bb587e77929bfa8d2e5',
          moderation: null,
          modblockedctx: null,
          modfollowedctx:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/2b002393948d0b27fd8d4ef2b8da12b966d5dcac113badeb616c076b07046f7a',
          modmentionedctx: null,
          modLikedPost: null,
          modBlockedPost: null,
          modBlockedUser: null,
          modFollowerUser: null,
        },
      },
    ],
    'should return all posts by tag'
  );

  await db.tags!.removeTagPost(
    '#test',
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c/bdbcc91d89ad6953c90585641766f41554be6ed19b57389e42056a4a2f876f2a'
  );
  // @ts-ignore
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
        type: 'POST',
        subtype: '',
        messageId:
          '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/f0579814819379c975b732309aa52505ba55747a56fb1bb587e77929bfa8d2e5',
        hash: 'f0579814819379c975b732309aa52505ba55747a56fb1bb587e77929bfa8d2e5',
        createdAt: '1647989013660',
        payload: { topic: '', title: '', content: 'test #test', reference: '', attachment: '' },
        meta: {
          replyCount: 3,
          likeCount: 0,
          repostCount: 0,
          liked: null,
          reposted: null,
          blocked: null,
          interepProvider: null,
          interepGroup: null,
          rootId:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/f0579814819379c975b732309aa52505ba55747a56fb1bb587e77929bfa8d2e5',
          moderation: null,
          modblockedctx: null,
          modfollowedctx:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/2b002393948d0b27fd8d4ef2b8da12b966d5dcac113badeb616c076b07046f7a',
          modmentionedctx: null,
          modLikedPost: null,
          modBlockedPost: null,
          modBlockedUser: null,
          modFollowerUser: null,
        },
      },
      {
        type: 'POST',
        subtype: 'REPLY',
        messageId:
          '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63/30d6bb9d8275795bdab6d5eb5f14010fe98793f42f633024aa9de4c83e5a60f1',
        hash: '30d6bb9d8275795bdab6d5eb5f14010fe98793f42f633024aa9de4c83e5a60f1',
        createdAt: '1647575979244',
        payload: {
          topic: '',
          title: '',
          content: 'hey!!!! #test',
          reference:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/dd528f6c8f108072ea6c055bb8cfe0f5cff406012a2e49794e3511f7ac62154a',
          attachment: '',
        },
        meta: {
          replyCount: 0,
          likeCount: 0,
          repostCount: 0,
          liked: null,
          reposted: null,
          blocked: null,
          interepProvider: null,
          interepGroup: null,
          rootId:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/dd528f6c8f108072ea6c055bb8cfe0f5cff406012a2e49794e3511f7ac62154a',
          moderation: 'THREAD_HIDE_BLOCK',
          modblockedctx: null,
          modfollowedctx:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/2b002393948d0b27fd8d4ef2b8da12b966d5dcac113badeb616c076b07046f7a',
          modmentionedctx: null,
          modLikedPost: null,
          modBlockedPost: null,
          modBlockedUser: null,
          modFollowerUser:
            '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb/523017325d3ff5b7afbdb427b8ac3158adfe88256b76f597588a1ceb8ce2ef09',
        },
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

  // @ts-ignore
  const { updatedAt, createdAt, ...um1 } = await db.userMeta!.findOne(
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c'
  );
  t.deepEqual(
    um1,
    {
      name: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
      followerCount: '4',
      followingCount: '4',
      blockedCount: '0',
      blockingCount: '0',
      mentionedCount: '2',
      postingCount: '22',
    },
    'should return user meta by name'
  );

  // @ts-ignore
  const { updatedAt, createdAt, ...user1 } = await db.users!.findOneByName(
    '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
    '0x3F425586D68616A113C29c303766DAD444167EE8'
  );
  t.deepEqual(
    user1,
    {
      username: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
      address: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
      joinedTx: '0x9e532171096cf4f4fe68cd384addf3baaf31644c48506cb4550efb586a165c5a',
      type: 'arbitrum',
      pubkey:
        'dBgXJATrP4KeE6zfuR4_arauMIeT_86MrQg6JbbnuxM.yJXykCW6qjB54B29by8vIWoMwk8T5NG_3awHdKC9Bgc',
      joinedAt: 1644251733000,
      name: 'yagamilight',
      bio: '',
      profileImage: 'https://i1.sndcdn.com/artworks-000452560338-e3uzc2-t500x500.jpg',
      coverImage: 'https://s3.amazonaws.com/99Covers-Facebook-Covers/watermark/14238.jpg',
      group: false,
      twitterVerification: 'https://twitter.com/0xTsukino/status/1465332814937690114',
      website: '',
      ecdh: '',
      idcommitment: '',
      meta: {
        inviteSent: null,
        acceptanceReceived: null,
        inviteReceived: null,
        acceptanceSent: null,
        blockedCount: 0,
        blockingCount: 0,
        followerCount: 4,
        followingCount: 4,
        postingCount: 22,
        mentionedCount: 2,
        followed:
          '0x3F425586D68616A113C29c303766DAD444167EE8/6cb3a3eea1355ead9cbcb0907e282eac3d1f606d7a8d77252445404a09d58584',
        blocked: null,
      },
    },
    'should return user by name'
  );

  // @ts-ignore
  const { updatedAt, createdAt, ...user2 } = await db.users!.findOneByPubkey(
    'MNw7njaTh0k835aq0JKtmpq33izkGwFxdldqf3txB64.a-yzwTFi1hNP-4lrpHB5NAw7p100oAOUefpYwfLPer8'
  );
  t.deepEqual(
    user2,
    {
      name: '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb',
      pubkey:
        'MNw7njaTh0k835aq0JKtmpq33izkGwFxdldqf3txB64.a-yzwTFi1hNP-4lrpHB5NAw7p100oAOUefpYwfLPer8',
      joinedAt: '1644254074000',
      tx: '0xfde1d05921ccb073f71b747fd323fa313d51c77db82311993555692881ff9387',
      type: 'arbitrum',
    },
    'should return user by pubkey'
  );

  // @ts-ignore
  const user3 = await db.users!.readAll('0x3F425586D68616A113C29c303766DAD444167EE8', 0, 5);
  t.deepEqual(
    user3,
    [
      {
        username: '0x09581b207F27b3E941D62d353194543d38182651',
        address: '0x09581b207F27b3E941D62d353194543d38182651',
        joinedTx: '0xa78e8c2e65ba073b29fbcb136b8f262c60464a3413ad6759d4cf41426573f35d',
        type: 'arbitrum',
        pubkey:
          'INXAI0WyuO24U2fdeN_m70gqLx2CXm49kKT_Mx3R6Cw.Uya6GtBfuHfrHR4Lkc8_BiN2HPFpQ_1Yr95S-AomGiM',
        joinedAt: 1645743703000,
        name: '',
        bio: '',
        profileImage: '',
        coverImage: '',
        group: false,
        twitterVerification: '',
        website: '',
        ecdh: '',
        idcommitment: '',
        meta: {
          inviteSent: null,
          acceptanceReceived: null,
          inviteReceived: null,
          acceptanceSent: null,
          blockedCount: 1,
          blockingCount: 0,
          followerCount: 0,
          followingCount: 0,
          postingCount: 0,
          mentionedCount: 0,
          followed: null,
          blocked: null,
        },
      },
      {
        username: '0x5d432ce201d2c03234e314d4703559102Ebf365C',
        address: '0x5d432ce201d2c03234e314d4703559102Ebf365C',
        joinedTx: '0x4522e7854fba0bafeadbe93f4242290699b0f47dc43b119148636c6c69506d3b',
        type: 'arbitrum',
        pubkey:
          'ohfgrR0yWExZj-zxb_dXLgL2q4WcqfUWjLpD9kpMSjc.odeQ30shx28Dscix1Ywfw0o1ofLgU0qJ8-URAr2xTeA',
        joinedAt: 1647991582000,
        name: 'Mr.Poopybutthole',
        bio: '',
        profileImage:
          'https://hips.hearstapps.com/hmg-prod.s3.amazonaws.com/images/rick-and-morty-poopybuthole-1574420029.jpg?crop=0.704xw:1.00xh;0,0&resize=480:*',
        coverImage:
          'https://imagesvc.meredithcorp.io/v3/mm/image?q=85&c=sc&poi=face&w=2000&h=1000&url=https%3A%2F%2Fstatic.onecms.io%2Fwp-content%2Fuploads%2Fsites%2F6%2F2017%2F07%2Fmr-poopybutthole-season-2-episode-4-2000.jpg',
        group: false,
        twitterVerification: '',
        website: '',
        ecdh: '',
        idcommitment: '',
        meta: {
          inviteSent: null,
          acceptanceReceived: null,
          inviteReceived: null,
          acceptanceSent: null,
          blockedCount: 0,
          blockingCount: 0,
          followerCount: 1,
          followingCount: 1,
          postingCount: 0,
          mentionedCount: 2,
          followed: null,
          blocked: null,
        },
      },
      {
        username: '0x3aec555a667EF810C4B0a0D064D6Fb7c66161360',
        address: '0x3aec555a667EF810C4B0a0D064D6Fb7c66161360',
        joinedTx: '0x0024f0472ec847e220d664202e37c4c2588df48c7d7a631d73f71dc23c33019c',
        type: 'arbitrum',
        pubkey:
          'gxQnqpLxu8E74yn4t0N5mCoaE7MfRxEg8LiSGoBpMMw.Hkk05CtLQZEVTorgPVEYj97PHBnK-atlOdixjvF0Kn4',
        joinedAt: 1648086605000,
        name: 'kanna chan',
        bio: '',
        profileImage: 'https://media3.giphy.com/media/WcEvIajIk332g/giphy.gif',
        coverImage: '',
        group: false,
        twitterVerification: '',
        website: '',
        ecdh: '',
        idcommitment: '',
        meta: {
          inviteSent: null,
          acceptanceReceived: null,
          inviteReceived: null,
          acceptanceSent: null,
          blockedCount: 0,
          blockingCount: 0,
          followerCount: 0,
          followingCount: 0,
          postingCount: 2,
          mentionedCount: 2,
          followed: null,
          blocked: null,
        },
      },
      {
        username: '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63',
        address: '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63',
        joinedTx: '0xc35bd6dbbeec827b2b6cccc1acaae032e6e9a0ebb190ba5d7c276d7c6cce0fc6',
        type: 'arbitrum',
        pubkey:
          'z-CGdwpcNR39Ib3j_uTnAVtEoWyCuhMIXhZijh272lo.3KcFAl0dkDzuAGj54PUVq1fpJzVpGlFeuTf3j8NabUI',
        joinedAt: 1647393506000,
        name: '0xFEBc',
        bio: '',
        profileImage: '',
        coverImage: '',
        group: false,
        twitterVerification: '',
        website: '',
        ecdh: '',
        idcommitment: '',
        meta: {
          inviteSent: null,
          acceptanceReceived: null,
          inviteReceived: null,
          acceptanceSent: null,
          blockedCount: 0,
          blockingCount: 1,
          followerCount: 1,
          followingCount: 2,
          postingCount: 5,
          mentionedCount: 3,
          followed: null,
          blocked: null,
        },
      },
      {
        username: '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb',
        address: '0x3E1E26f055Cd29053D44Fc65aa1FCa216DedFceb',
        joinedTx: '0xfde1d05921ccb073f71b747fd323fa313d51c77db82311993555692881ff9387',
        type: 'arbitrum',
        pubkey:
          'MNw7njaTh0k835aq0JKtmpq33izkGwFxdldqf3txB64.a-yzwTFi1hNP-4lrpHB5NAw7p100oAOUefpYwfLPer8',
        joinedAt: 1644254074000,
        name: 'Ohwee',
        bio: '',
        profileImage: '',
        coverImage: '',
        group: false,
        twitterVerification: '',
        website: '',
        ecdh: '',
        idcommitment: '',
        meta: {
          inviteSent: null,
          acceptanceReceived: null,
          inviteReceived: null,
          acceptanceSent: null,
          blockedCount: 0,
          blockingCount: 0,
          followerCount: 2,
          followingCount: 3,
          postingCount: 7,
          mentionedCount: 2,
          followed: null,
          blocked: null,
        },
      },
    ],
    'should return all users'
  );

  // @ts-ignore
  const user4 = await db.users!.search('yaga', '0x3F425586D68616A113C29c303766DAD444167EE8', 0, 2);
  t.deepEqual(
    user4,
    [
      {
        username: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
        address: '0xd44a82dD160217d46D754a03C8f841edF06EBE3c',
        joinedTx: '0x9e532171096cf4f4fe68cd384addf3baaf31644c48506cb4550efb586a165c5a',
        type: 'arbitrum',
        pubkey:
          'dBgXJATrP4KeE6zfuR4_arauMIeT_86MrQg6JbbnuxM.yJXykCW6qjB54B29by8vIWoMwk8T5NG_3awHdKC9Bgc',
        joinedAt: 1644251733000,
        name: 'yagamilight',
        bio: '',
        profileImage: 'https://i1.sndcdn.com/artworks-000452560338-e3uzc2-t500x500.jpg',
        coverImage: 'https://s3.amazonaws.com/99Covers-Facebook-Covers/watermark/14238.jpg',
        group: false,
        twitterVerification: 'https://twitter.com/0xTsukino/status/1465332814937690114',
        website: '',
        ecdh: '',
        idcommitment: '',
        meta: {
          inviteSent: null,
          acceptanceReceived: null,
          inviteReceived: null,
          acceptanceSent: null,
          blockedCount: 0,
          blockingCount: 0,
          followerCount: 4,
          followingCount: 4,
          postingCount: 22,
          mentionedCount: 2,
          followed:
            '0x3F425586D68616A113C29c303766DAD444167EE8/6cb3a3eea1355ead9cbcb0907e282eac3d1f606d7a8d77252445404a09d58584',
          blocked: null,
        },
      },
    ],
    'should search user by name'
  );

  await db.stop();
  if (fs.existsSync(gunpath)) fs.unlinkSync(gunpath);
  t.end();
});

tape('EXIT', t => {
  t.end();
  process.exit(0);
});
