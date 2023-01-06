import 'isomorphic-fetch';
import sinon, { SinonStub } from 'sinon';

let fetchStub: any;
export const stubFetch = () => {
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
      findAllRetweets: SinonStub;
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
      findAllLikesByReference: SinonStub;
    };
    connections: {
      findOne: SinonStub;
      createConnection: SinonStub;
      findAllFollowersByName: SinonStub;
      findAllFollowingsByCreator: SinonStub;
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
    zkchat: {
      verifyRLNProof: SinonStub;
      checkShare: SinonStub;
    };
  }
] => {
  const callStub = sinon.stub(service, 'call');

  const app = {
    read: sinon.stub(),
    updateLastArbitrumBlock: sinon.stub(),
  };

  const ens = {
    update: sinon.stub(),
  };

  const semaphore = {
    addID: sinon.stub(),
    findAllByCommitment: sinon.stub(),
    findOneByCommitment: sinon.stub(),
    removeID: sinon.stub(),
  };

  const interepGroups = {
    addHash: sinon.stub(),
    findOneByHash: sinon.stub(),
  };

  const users = {
    ensureUser: sinon.stub(),
    findOneByName: sinon.stub(),
    findOneByPubkey: sinon.stub(),
    readAll: sinon.stub(),
    search: sinon.stub(),
    updateOrCreateUser: sinon.stub(),
  };

  const posts = {
    createPost: sinon.stub(),
    createTwitterPosts: sinon.stub(),
    ensurePost: sinon.stub(),
    findAllLikedPostsByCreator: sinon.stub(),
    findAllPosts: sinon.stub(),
    findAllReplies: sinon.stub(),
    findAllRepliesFromCreator: sinon.stub(),
    findAllRetweets: sinon.stub(),
    findLastTweetInConversation: sinon.stub(),
    findOne: sinon.stub(),
    findRoot: sinon.stub(),
    getHomeFeed: sinon.stub(),
    remove: sinon.stub(),
  };

  const moderations = {
    createModeration: sinon.stub(),
    findAllLikesByReference: sinon.stub(),
    findOne: sinon.stub(),
    remove: sinon.stub(),
  };

  const connections = {
    createConnection: sinon.stub(),
    findAllFollowersByName: sinon.stub(),
    findAllFollowingsByCreator: sinon.stub(),
    findOne: sinon.stub(),
    remove: sinon.stub(),
  };

  const profiles = {
    createProfile: sinon.stub(),
    findOne: sinon.stub(),
    remove: sinon.stub(),
  };

  const meta = {
    addLike: sinon.stub(),
    addPost: sinon.stub(),
    addReply: sinon.stub(),
    addRepost: sinon.stub(),
    findTags: sinon.stub(),
    removeLike: sinon.stub(),
    removePost: sinon.stub(),
    removeReply: sinon.stub(),
    removeRepost: sinon.stub(),
  };

  const userMeta = {
    addBlocked: sinon.stub(),
    addBlocking: sinon.stub(),
    addFollower: sinon.stub(),
    addFollowing: sinon.stub(),
    addMentionedCount: sinon.stub(),
    addPostingCount: sinon.stub(),
    removeBlocked: sinon.stub(),
    removeBlocking: sinon.stub(),
    removeFollower: sinon.stub(),
    removeFollowing: sinon.stub(),
    removeMentionedCount: sinon.stub(),
    removePostingCount: sinon.stub(),
  };

  const semaphoreCreators = {
    addSemaphoreCreator: sinon.stub(),
  };

  const tags = {
    addTagPost: sinon.stub(),
    getPostsByTag: sinon.stub(),
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

  const zkchat = {
    checkShare: sinon.stub(),
    verifyRLNProof: sinon.stub(),
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
    .withArgs('db', 'getZKChat')
    .returns(Promise.resolve(zkchat));

  return [
    callStub,
    {
      app,
      connections,
      ens,
      interepGroups,
      link,
      meta,
      moderations,
      posts,
      profiles,
      semaphore,
      semaphoreCreators,
      tags,
      threads,
      twitterAuths,
      userMeta,
      users,
      zkchat,
    },
  ];
};

export const newRequest = (params?: any, body?: any, query?: any): any => {
  return {
    body,
    header: () => null,
    params,
    query: {
      limit: 10,
      offset: 0,
      ...query,
    },
    session: {},
  };
};

export const newResponse = (): any => {
  const ret: any = {
    send: sinon.stub(),
  };

  ret.status = sinon.stub().returns(ret);

  return ret;
};
