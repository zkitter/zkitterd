import 'isomorphic-fetch';
import sinon, { SinonStub } from 'sinon';

let fetchStub: any;
export const stubFetch = () => {
    // @ts-ignore
    fetchStub = fetchStub || sinon.stub(global, 'fetch');
    return fetchStub;
};

export const stubCall = (
    service: any
): [
    SinonStub,
    {
        app: {
            read: SinonStub;
            updateLastArbitrumBlock: SinonStub;
        };
        ens: {
            update: SinonStub;
        };
        semaphore: {
            addID: SinonStub;
            removeID: SinonStub;
            findOneByCommitment: SinonStub;
            findAllByCommitment: SinonStub;
        };
        interepGroups: {
            findOneByHash: SinonStub;
            addHash: SinonStub;
        };
        users: {
            updateOrCreateUser: SinonStub;
            findOneByName: SinonStub;
            readAll: SinonStub;
            search: SinonStub;
            ensureUser: SinonStub;
            findOneByPubkey: SinonStub;
        };
        posts: {
            findLastTweetInConversation: SinonStub;
            findAllRepliesFromCreator: SinonStub;
            findAllLikedPostsByCreator: SinonStub;
            getHomeFeed: SinonStub;
            createTwitterPosts: SinonStub;
            findAllPosts: SinonStub;
            findAllReplies: SinonStub;
            findRoot: SinonStub;
            ensurePost: SinonStub;
            findOne: SinonStub;
            createPost: SinonStub;
            remove: SinonStub;
        };
        meta: {
            findTags: SinonStub;
            addPost: SinonStub;
            addReply: SinonStub;
            addRepost: SinonStub;
            addLike: SinonStub;
            removePost: SinonStub;
            removeReply: SinonStub;
            removeRepost: SinonStub;
            removeLike: SinonStub;
        };
        userMeta: {
            addPostingCount: SinonStub;
            addMentionedCount: SinonStub;
            addFollower: SinonStub;
            addFollowing: SinonStub;
            addBlocked: SinonStub;
            addBlocking: SinonStub;
            removePostingCount: SinonStub;
            removeMentionedCount: SinonStub;
            removeFollower: SinonStub;
            removeFollowing: SinonStub;
            removeBlocked: SinonStub;
            removeBlocking: SinonStub;
        };
        moderations: {
            findOne: SinonStub;
            createModeration: SinonStub;
            remove: SinonStub;
        };
        connections: {
            findOne: SinonStub;
            createConnection: SinonStub;
            remove: SinonStub;
        };
        profiles: {
            findOne: SinonStub;
            createProfile: SinonStub;
            remove: SinonStub;
        };
        semaphoreCreators: {
            addSemaphoreCreator: SinonStub;
        };
        tags: {
            getPostsByTag: SinonStub;
            addTagPost: SinonStub;
            removeTagPost: SinonStub;
        };
        threads: {
            addThreadData: SinonStub;
        };
        twitterAuths: {
            findUserByToken: SinonStub;
            addAccount: SinonStub;
        };
        link: {
            read: SinonStub;
            update: SinonStub;
        };
        merkle: {
            getGroupByRoot: SinonStub;
        };
        zkchat: {
            verifyRLNProof: SinonStub;
            checkShare: SinonStub;
        };
    }
] => {
    const callStub = sinon.stub(service, 'call');

    const app = {
        updateLastArbitrumBlock: sinon.stub(),
        read: sinon.stub(),
    };

    const ens = {
        update: sinon.stub(),
    };

    const semaphore = {
        addID: sinon.stub(),
        removeID: sinon.stub(),
        findOneByCommitment: sinon.stub(),
        findAllByCommitment: sinon.stub(),
    };

    const interepGroups = {
        findOneByHash: sinon.stub(),
        addHash: sinon.stub(),
    };

    const users = {
        findOneByName: sinon.stub(),
        readAll: sinon.stub(),
        search: sinon.stub(),
        ensureUser: sinon.stub(),
        findOneByPubkey: sinon.stub(),
        updateOrCreateUser: sinon.stub(),
    };

    const posts = {
        findLastTweetInConversation: sinon.stub(),
        findAllRepliesFromCreator: sinon.stub(),
        findAllLikedPostsByCreator: sinon.stub(),
        getHomeFeed: sinon.stub(),
        findAllPosts: sinon.stub(),
        findAllReplies: sinon.stub(),
        createTwitterPosts: sinon.stub(),
        findRoot: sinon.stub(),
        ensurePost: sinon.stub(),
        findOne: sinon.stub(),
        createPost: sinon.stub(),
        remove: sinon.stub(),
    };

    const moderations = {
        findOne: sinon.stub(),
        createModeration: sinon.stub(),
        remove: sinon.stub(),
    };

    const connections = {
        findOne: sinon.stub(),
        createConnection: sinon.stub(),
        remove: sinon.stub(),
    };

    const profiles = {
        findOne: sinon.stub(),
        createProfile: sinon.stub(),
        remove: sinon.stub(),
    };

    const meta = {
        findTags: sinon.stub(),
        addPost: sinon.stub(),
        addReply: sinon.stub(),
        addRepost: sinon.stub(),
        addLike: sinon.stub(),
        removePost: sinon.stub(),
        removeReply: sinon.stub(),
        removeRepost: sinon.stub(),
        removeLike: sinon.stub(),
    };

    const userMeta = {
        addPostingCount: sinon.stub(),
        addMentionedCount: sinon.stub(),
        addFollower: sinon.stub(),
        addFollowing: sinon.stub(),
        addBlocked: sinon.stub(),
        addBlocking: sinon.stub(),
        removePostingCount: sinon.stub(),
        removeMentionedCount: sinon.stub(),
        removeFollower: sinon.stub(),
        removeFollowing: sinon.stub(),
        removeBlocked: sinon.stub(),
        removeBlocking: sinon.stub(),
    };

    const semaphoreCreators = {
        addSemaphoreCreator: sinon.stub(),
    };

    const tags = {
        getPostsByTag: sinon.stub(),
        addTagPost: sinon.stub(),
        removeTagPost: sinon.stub(),
    };

    const threads = {
        addThreadData: sinon.stub(),
    };

    const twitterAuths = {
        addAccount: sinon.stub(),
        findUserByToken: sinon.stub(),
    };

    const link = {
        read: sinon.stub(),
        update: sinon.stub(),
    };

    const merkle = {
        getGroupByRoot: sinon.stub(),
    };

    const zkchat = {
        verifyRLNProof: sinon.stub(),
        checkShare: sinon.stub(),
    };

    callStub
        .withArgs('db', 'getSemaphore')
        .returns(Promise.resolve(semaphore))
        .withArgs('db', 'getInterepGroups')
        .returns(Promise.resolve(interepGroups))
        .withArgs('db', 'getUsers')
        .returns(Promise.resolve(users))
        .withArgs('db', 'getPosts')
        .returns(Promise.resolve(posts))
        .withArgs('db', 'getMeta')
        .returns(Promise.resolve(meta))
        .withArgs('db', 'getUserMeta')
        .returns(Promise.resolve(userMeta))
        .withArgs('db', 'getSemaphoreCreators')
        .returns(Promise.resolve(semaphoreCreators))
        .withArgs('db', 'getTags')
        .returns(Promise.resolve(tags))
        .withArgs('db', 'getThreads')
        .returns(Promise.resolve(threads))
        .withArgs('db', 'getModerations')
        .returns(Promise.resolve(moderations))
        .withArgs('db', 'getConnections')
        .returns(Promise.resolve(connections))
        .withArgs('db', 'getProfiles')
        .returns(Promise.resolve(profiles))
        .withArgs('db', 'getTwitterAuth')
        .returns(Promise.resolve(twitterAuths))
        .withArgs('db', 'getENS')
        .returns(Promise.resolve(ens))
        .withArgs('db', 'getApp')
        .returns(Promise.resolve(app))
        .withArgs('db', 'getLinkPreview')
        .returns(Promise.resolve(link))
        .withArgs('db', 'getMerkle')
        .returns(Promise.resolve(merkle))
        .withArgs('db', 'getZKChat')
        .returns(Promise.resolve(zkchat));

    return [
        callStub,
        {
            app,
            ens,
            semaphore,
            interepGroups,
            users,
            posts,
            moderations,
            connections,
            meta,
            userMeta,
            semaphoreCreators,
            tags,
            threads,
            profiles,
            twitterAuths,
            link,
            merkle,
            zkchat,
        },
    ];
};
