import tape from "tape";
import sinon from "sinon";
import { Semaphore } from "@zk-kit/protocols";
import GunService from "./gun";
import {stubCall, stubFetch} from "../util/testUtils";
const fetchStub = stubFetch();

const verifyProofStub = sinon.stub(Semaphore, 'verifyProof').returns(Promise.resolve(true));

tape('GunService - insert a post', async t => {
    const gun = new GunService();
    // @ts-ignore
    gun.gun = { get: sinon.stub() };
    const [callStub, stubs] = stubCall(gun);

    stubs.users.findOneByPubkey.returns(Promise.resolve({
        type: 'arbitrum',
        name: '0xmockuser',
    }));

    // @ts-ignore
    gun.gun.get.returns(Promise.resolve({
        topic: 'unitest',
        title: 'unit test post',
        content: 'hello world!',
    }))

    await gun.handleGunMessage({
        type: 'POST',
        subtype: '',
        createdAt: 1648591319888,
        payload: {
            '#': '_id',
        },
    }, '0xmockuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501');

    t.deepEqual(
        stubs.posts.findOne.args[0],
        ['1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'],
        'should use correct hash',
    );


    t.deepEqual(
        stubs.posts.createPost.args[0],
        [
            {
                messageId: '0xmockuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501',
                hash: '1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501',
                proof: undefined,
                signals: undefined,
                type: 'POST',
                subtype: '',
                creator: '0xmockuser',
                createdAt: 1648591319888,
                topic: 'unitest',
                title: 'unit test post',
                content: 'hello world!',
                reference: '',
                attachment: '',
            },
        ],
        'should create post',
    );

    t.deepEqual(
        stubs.threads.addThreadData.args[0],
        ['0xmockuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501', '0xmockuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'],
        'should add thread data',
    );

    t.equal(stubs.userMeta.addPostingCount.args[0][0], '0xmockuser', 'should add posting count');

    t.end();
});


tape('GunService - insert an anon post', async t => {
    const gun = new GunService();
    // @ts-ignore
    gun.gun = { get: sinon.stub() };
    const [callStub, stubs] = stubCall(gun);

    callStub.withArgs('interrep', 'getBatchFromRootHash').returns(Promise.resolve({
        name: 'gold',
        provider: 'twitter',
    }));
    stubs.users.findOneByPubkey.returns(Promise.resolve({
        type: 'arbitrum',
        name: '0xmockuser',
    }));

    // @ts-ignore
    gun.gun.get.returns(Promise.resolve({
        content: '#TODO Gitdoc writing plus add link(s) to auti.sm',
    }))

    await gun.handleGunMessage({
        type: 'POST',
        subtype: '',
        createdAt: 1647662813555,
        proof: '{"pi_a":["10738850261530383882913213070352648788584329780714230714412402465638191591193","1720646200951945389125239217951991681446236908014420063654481714061423541792","1"],"pi_b":[["10823728439575559224699767333568509492031541334992795594954510299565678158019","2822851290501026062374067638860362709100261858317972565325804191976661813533"],["8626575743446424152061055290092135354964182891717736149609514518179219868261","20013393640664303578119959828582721731895461998096421334759060713357659967734"],["1","0"]],"pi_c":["13177698692881833653457921446467037130583405505174672101848995468158375986586","2730147623484961652190338096306402848685558623832560853028542982656313687419","1"],"protocol":"groth16","curve":"bn128"}',
        publicSignals: '{"merkleRoot":"4704055903606797586090696501720686880340692275401050921461939308501303651874","nullifierHash":"4904503323967168022037685582990169278203487940113760390449470514324229000592","signalHash":"397114252203852149264915498647462864172430630160183803847823269676582256735","externalNullifier":"2547378419007707488172618231500652926330420198689895938971900836324579"}',
        payload: {
            '#': '_id',
        },
    }, '5fa336923158565f8df0f3cb408f8fa5d0d671a1c5c0f6731bed71b79c3397f4');

    t.deepEqual(
        stubs.posts.findOne.args[0],
        ['5fa336923158565f8df0f3cb408f8fa5d0d671a1c5c0f6731bed71b79c3397f4'],
        'should use correct hash',
    );

    t.deepEqual(
        stubs.posts.createPost.args[0],
        [
            {
                messageId: '5fa336923158565f8df0f3cb408f8fa5d0d671a1c5c0f6731bed71b79c3397f4',
                hash: '5fa336923158565f8df0f3cb408f8fa5d0d671a1c5c0f6731bed71b79c3397f4',
                proof: '{"pi_a":["10738850261530383882913213070352648788584329780714230714412402465638191591193","1720646200951945389125239217951991681446236908014420063654481714061423541792","1"],"pi_b":[["10823728439575559224699767333568509492031541334992795594954510299565678158019","2822851290501026062374067638860362709100261858317972565325804191976661813533"],["8626575743446424152061055290092135354964182891717736149609514518179219868261","20013393640664303578119959828582721731895461998096421334759060713357659967734"],["1","0"]],"pi_c":["13177698692881833653457921446467037130583405505174672101848995468158375986586","2730147623484961652190338096306402848685558623832560853028542982656313687419","1"],"protocol":"groth16","curve":"bn128"}',
                signals: '{"merkleRoot":"4704055903606797586090696501720686880340692275401050921461939308501303651874","nullifierHash":"4904503323967168022037685582990169278203487940113760390449470514324229000592","signalHash":"397114252203852149264915498647462864172430630160183803847823269676582256735","externalNullifier":"2547378419007707488172618231500652926330420198689895938971900836324579"}',
                type: 'POST',
                subtype: '',
                creator: '',
                createdAt: 1647662813555,
                topic: '',
                title: '',
                content: '#TODO Gitdoc writing plus add link(s) to auti.sm',
                reference: '',
                attachment: '',
            },
        ],
        'should create post',
    );

    t.deepEqual(
        stubs.threads.addThreadData.args[0],
        ['5fa336923158565f8df0f3cb408f8fa5d0d671a1c5c0f6731bed71b79c3397f4', '5fa336923158565f8df0f3cb408f8fa5d0d671a1c5c0f6731bed71b79c3397f4' ],
        'should add thread data',
    );

    t.deepEqual(
        stubs.semaphoreCreators.addSemaphoreCreator.args[0],
        ['5fa336923158565f8df0f3cb408f8fa5d0d671a1c5c0f6731bed71b79c3397f4', 'twitter', 'gold'],
        'should add semaphore creator',
    );

    verifyProofStub.reset();
    t.end();
});

tape('GunService - insert a reply', async t => {
    const gun = new GunService();
    // @ts-ignore
    gun.gun = { get: sinon.stub() };
    const [callStub, stubs] = stubCall(gun);

    callStub.withArgs('ens', 'fetchAddressByName').returns(Promise.resolve('0x123456'))

    stubs.users.findOneByPubkey.returns(Promise.resolve({
        type: 'arbitrum',
        name: '0xreplyuser',
    }));

    // @ts-ignore
    gun.gun.get.returns(Promise.resolve({
        topic: 'reply',
        title: 'unit test reply',
        reference: '0x123/a1f3a12fbeb7f8087cec3be9252e2dc4859100dbdb77dd8a2816678dc17b1238',
        attachment: '',
        content: 'hello world! #reply @0x123456',
    }))

    stubs.posts.findRoot.returns(Promise.resolve('ROOT'));

    await gun.handleGunMessage({
        type: 'POST',
        subtype: 'REPLY',
        createdAt: 1648591319888,
        payload: {
            '#': '_id',
        },
    }, '0xreplyuser/a1f3a12fbeb7f8087cec3be9252e2dc4859100dbdb77dd8a2816678dc17b1238');

    t.deepEqual(
        stubs.posts.findOne.args[0],
        ['d8064c6026b7f01bf3a8162a63ea2f4f1d7aaa8d935c35cd60913f8950a8cfa3'],
        'should use correct hash',
    );

    t.deepEqual(
        stubs.posts.createPost.args[0],
        [
            {
                messageId: '0xreplyuser/d8064c6026b7f01bf3a8162a63ea2f4f1d7aaa8d935c35cd60913f8950a8cfa3',
                hash: 'd8064c6026b7f01bf3a8162a63ea2f4f1d7aaa8d935c35cd60913f8950a8cfa3',
                proof: undefined,
                signals: undefined,
                type: 'POST',
                subtype: 'REPLY',
                creator: '0xreplyuser',
                createdAt: 1648591319888,
                topic: 'reply',
                title: 'unit test reply',
                content: 'hello world! #reply @0x123456',
                reference: '0x123/a1f3a12fbeb7f8087cec3be9252e2dc4859100dbdb77dd8a2816678dc17b1238',
                attachment: '',
            },
        ],
        'should create post',
    );

    t.deepEqual(
        stubs.threads.addThreadData.args[0],
        ['ROOT', '0xreplyuser/d8064c6026b7f01bf3a8162a63ea2f4f1d7aaa8d935c35cd60913f8950a8cfa3'],
        'should add thread data',
    );

    t.deepEqual(
        stubs.tags.addTagPost.args[0],
        ['#reply', '0xreplyuser/d8064c6026b7f01bf3a8162a63ea2f4f1d7aaa8d935c35cd60913f8950a8cfa3'],
        'should add hash tags',
    );

    t.deepEqual(
        stubs.meta.addPost.args[0],
        ['#reply'],
        'should add post counts to hash tag',
    );

    t.deepEqual(
        stubs.tags.addTagPost.args[1],
        ['@0x123456', '0xreplyuser/d8064c6026b7f01bf3a8162a63ea2f4f1d7aaa8d935c35cd60913f8950a8cfa3'],
        'should add mentions',
    );

    t.deepEqual(
        stubs.userMeta.addMentionedCount.args[0],
        ['0x123456'],
        'should add mentioned counts to user meta',
    );

    t.end();
});

tape('GunService - insert a moderation', async t => {
    const gun = new GunService();
    // @ts-ignore
    gun.gun = { get: sinon.stub() };
    const [callStub, stubs] = stubCall(gun);

    stubs.users.findOneByPubkey.returns(Promise.resolve({
        type: 'arbitrum',
        name: '0xmockuser',
    }));

    // @ts-ignore
    gun.gun.get.returns(Promise.resolve({
        reference: '0x123/3456',
    }))

    await gun.handleGunMessage({
        type: 'MODERATION',
        subtype: 'LIKE',
        createdAt: 1648591319888,
        payload: {
            '#': '_id',
        },
    }, '0xmockuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501');

    t.deepEqual(
        stubs.moderations.findOne.args[0],
        ['edaeea596a25b2df34f24a6b8d5a746957e8e0f5c184c924cc52a606852effa7'],
        'should use correct hash',
    );

    t.equal(stubs.posts.ensurePost.args[0][0], '0x123/3456', 'should ensure post');

    t.deepEqual(
        stubs.moderations.createModeration.args[0],
        [
            {
                messageId: '0xmockuser/edaeea596a25b2df34f24a6b8d5a746957e8e0f5c184c924cc52a606852effa7',
                hash: 'edaeea596a25b2df34f24a6b8d5a746957e8e0f5c184c924cc52a606852effa7',
                type: 'MODERATION',
                subtype: 'LIKE',
                creator: '0xmockuser',
                createdAt: 1648591319888,
                reference: '0x123/3456',
            },
        ],
        'should create moderation',
    );

    t.deepEqual(
        stubs.meta.addLike.args[0],
        ['0x123/3456'],
        'should add like counts',
    );

    t.end();
});

tape('GunService - insert a connection', async t => {
    const gun = new GunService();
    // @ts-ignore
    gun.gun = { get: sinon.stub() };
    const [callStub, stubs] = stubCall(gun);

    stubs.users.findOneByPubkey.returns(Promise.resolve({
        type: 'arbitrum',
        name: '0xmockuser',
    }));

    // @ts-ignore
    gun.gun.get.returns(Promise.resolve({
        name: '0xotheruser',
    }))

    await gun.handleGunMessage({
        type: 'CONNECTION',
        subtype: 'FOLLOW',
        createdAt: 1648591319888,
        payload: {
            '#': '_id',
        },
    }, '0xmockuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501');

    t.deepEqual(
        stubs.connections.findOne.args[0],
        ['82d5f06010f32aadfc8953c0491b726ae14c3e0d9690bd736ee0c31bdc9ddae1'],
        'should use correct hash',
    );

    t.equal(stubs.users.ensureUser.args[0][0], '0xotheruser', 'should ensure user');

    t.deepEqual(
        stubs.connections.createConnection.args[0],
        [
            {
                messageId: '0xmockuser/82d5f06010f32aadfc8953c0491b726ae14c3e0d9690bd736ee0c31bdc9ddae1',
                hash: '82d5f06010f32aadfc8953c0491b726ae14c3e0d9690bd736ee0c31bdc9ddae1',
                type: 'CONNECTION',
                subtype: 'FOLLOW',
                creator: '0xmockuser',
                createdAt: 1648591319888,
                name: '0xotheruser',
            },
        ],
        'should create connections',
    );

    t.deepEqual(
        stubs.userMeta.addFollower.args[0],
        ['0xotheruser'],
        'should add like counts',
    );

    t.deepEqual(
        stubs.userMeta.addFollowing.args[0],
        ['0xmockuser'],
        'should add like counts',
    );

    t.end();
});

tape('GunService - insert a profile', async t => {
    const gun = new GunService();
    // @ts-ignore
    gun.gun = { get: sinon.stub() };
    const [callStub, stubs] = stubCall(gun);

    stubs.users.findOneByPubkey.returns(Promise.resolve({
        type: 'arbitrum',
        name: '0xmockuser',
    }));

    // @ts-ignore
    gun.gun.get.returns(Promise.resolve({
        key: 'twitter_user_handle',
        value: 'wowow',
    }))

    fetchStub.returns(Promise.resolve({
        status: 200,
        json: async () => ({
            entities: { urls: [{ expanded_url: ['0xmockuser'] }] },
            user: { screen_name: 'twitter_user_handle' },
        }),
    }))

    await gun.handleGunMessage({
        type: 'PROFILE',
        subtype: 'TWT_VERIFICATION',
        createdAt: 1648591319888,
        payload: {
            '#': '_id',
        },
    }, '0xmockuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501');

    t.deepEqual(
        stubs.profiles.findOne.args[0],
        ['c5308a456cc7ac29d050bcb5f25230b0bcf537a76969aa69d25b4889e50eb751'],
        'should use correct hash',
    );

    t.deepEqual(
        stubs.twitterAuths.addAccount.args[0],
        ['twitter_user_handle', '0xmockuser'],
        'should add new twitter account',
    );

    t.deepEqual(
        stubs.profiles.createProfile.args[0],
        [
            {
                messageId: '0xmockuser/c5308a456cc7ac29d050bcb5f25230b0bcf537a76969aa69d25b4889e50eb751',
                hash: 'c5308a456cc7ac29d050bcb5f25230b0bcf537a76969aa69d25b4889e50eb751',
                type: 'PROFILE',
                subtype: 'TWT_VERIFICATION',
                creator: '0xmockuser',
                createdAt: 1648591319888,
                key: 'twitter_user_handle',
                value: 'wowow',
            },
        ],
        'should create profile',
    );

    fetchStub.reset();
    t.end();
});

tape('GunService - delete post', async t => {
    const gun = new GunService();
    // @ts-ignore
    gun.gun = { get: sinon.stub() };
    const [callStub, stubs] = stubCall(gun);

    callStub.withArgs('ens', 'fetchAddressByName')
        .returns(Promise.resolve('0xmentionuser'));

    stubs.users.findOneByPubkey.returns(Promise.resolve({
        type: 'arbitrum',
        name: '0xmyuser',
    }));

    stubs.posts.findOne.returns(Promise.resolve({
        subtype: '',
        creator: '0xmyuser',
        payload: {
            content: '@0xmentionuser #hashtag',
        },
    }))

    await gun.handleGunMessage(
        null,
        '0xmyuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501',
    );

    t.deepEqual(
        stubs.tags.removeTagPost.args[0],
        ['#hashtag', '0xmyuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'],
        'should remove following meta',
    );

    t.deepEqual(
        stubs.tags.removeTagPost.args[1],
        ['@0xmentionuser', '0xmyuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'],
        'should remove following meta',
    );

    t.deepEqual(
        stubs.userMeta.removeMentionedCount.args[0],
        ['0xmentionuser'],
        'should remove following meta',
    );

    t.deepEqual(
        stubs.meta.removePost.args[0],
        ['#hashtag'],
        'should remove follower meta',
    );

    t.deepEqual(
        stubs.posts.remove.args[0],
        ['1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'],
        'should remove follower meta',
    );

    t.end();
});

tape('GunService - delete moderation', async t => {
    const gun = new GunService();
    // @ts-ignore
    gun.gun = { get: sinon.stub() };
    const [callStub, stubs] = stubCall(gun);

    stubs.users.findOneByPubkey.returns(Promise.resolve({
        type: 'arbitrum',
        name: '0xmockuser',
    }));

    stubs.moderations.findOne.returns(Promise.resolve({
        subtype: 'LIKE',
        reference: '0xotheruser/posthash',
    }))

    await gun.handleGunMessage(
        null,
        '0xmockuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501',
    );

    t.deepEqual(
        stubs.meta.removeLike.args[0],
        ['0xotheruser/posthash'],
        'should remove follower meta',
    );

    t.deepEqual(
        stubs.moderations.remove.args[0],
        ['1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'],
        'should remove connection',
    );

    t.end();
});

tape('GunService - delete connections', async t => {
    const gun = new GunService();
    // @ts-ignore
    gun.gun = { get: sinon.stub() };
    const [callStub, stubs] = stubCall(gun);

    stubs.users.findOneByPubkey.returns(Promise.resolve({
        type: 'arbitrum',
        name: '0xmockuser',
    }));

    stubs.connections.findOne.returns(Promise.resolve({
        subtype: 'FOLLOW',
        creator: '0xmyuser',
        name: '0xotheruser',
    }))

    await gun.handleGunMessage(
        null,
        '0xmockuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501',
    );

    t.deepEqual(
        stubs.userMeta.removeFollowing.args[0],
        ['0xmyuser'],
        'should remove following meta',
    );

    t.deepEqual(
        stubs.userMeta.removeFollower.args[0],
        ['0xotheruser'],
        'should remove follower meta',
    );

    t.deepEqual(
        stubs.connections.remove.args[0],
        ['1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'],
        'should remove connection',
    );

    t.end();
});

tape('GunService - delete profile', async t => {
    const gun = new GunService();
    // @ts-ignore
    gun.gun = { get: sinon.stub() };
    const [callStub, stubs] = stubCall(gun);

    stubs.users.findOneByPubkey.returns(Promise.resolve({
        type: 'arbitrum',
        name: '0xmockuser',
    }));

    stubs.profiles.findOne.returns(Promise.resolve({
        key: 'hi',
        value: 'world',
    }))

    await gun.handleGunMessage(
        null,
        '0xmockuser/1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501',
    );

    t.deepEqual(
        stubs.profiles.remove.args[0],
        ['1726aab56ed23eca07e153b252361bec9c23d496905f480864dc0e51b8834501'],
        'should remove connection',
    );

    t.end();
});