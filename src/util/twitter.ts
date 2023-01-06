const { Botometer } = require('botometer');

import crypto from 'crypto';
import { URLSearchParams } from 'url';
import { PostModel } from '@models/posts';
import config from './config';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const OAuth = require('oauth-1.0a');

const TW_REQ_TOKEN_URL = 'https://api.twitter.com/oauth/request_token';
export const TW_AUTH_URL = 'https://api.twitter.com/oauth/authenticate';
const TW_ACCESS_TOKEN_URL = 'https://api.twitter.com/oauth/access_token';
const TW_CALLBACK_URL = config.twCallbackUrl;
const TW_CONSUMER_KEY = config.twConsumerKey;
const TW_CONSUMER_SECRET = config.twConsumerSecret;
const TW_BEARER_TOKEN = config.twBearerToken;
const TW_ACCESS_KEY = config.twAccessKey;
const TW_ACCESS_SECRET = config.twAccessSecret;

const botometer = new Botometer({
  accessToken: TW_ACCESS_KEY,
  accessTokenSecret: TW_ACCESS_SECRET,
  consumerKey: TW_CONSUMER_KEY,
  consumerSecret: TW_CONSUMER_SECRET,
  rapidApiKey: config.rapidAPIKey,
  usePro: true,
});

const oauth = OAuth({
  consumer: {
    key: TW_CONSUMER_KEY,
    secret: TW_CONSUMER_SECRET,
  },
  hash_function: (baseString: string, key: string) => {
    return crypto.createHmac('sha1', key).update(baseString).digest('base64');
  },
  signature_method: 'HMAC-SHA1',
});

export const createHeader = (requestData: any, key: string, secret: string) => {
  return oauth.toHeader(
    oauth.authorize(requestData, {
      key: key,
      secret: secret,
    })
  );
};

export const requestToken = async (): Promise<string> => {
  const requestData = {
    data: {
      oauth_callback: TW_CALLBACK_URL,
    },
    method: 'POST',
    url: TW_REQ_TOKEN_URL,
  };

  const resp = await fetch(requestData.url, {
    // @ts-expect-error ...
    form: requestData.data,
    headers: {
      ...oauth.toHeader(oauth.authorize(requestData)),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: requestData.method,
  });

  if (resp.status !== 200) throw new Error(resp.statusText);

  return await resp.text();
};

export const accessToken = async (token: string, verifier: string, tokenSecret: string) => {
  const requestData = {
    data: {
      oauth_token: token,
      oauth_token_secret: tokenSecret,
      oauth_verifier: verifier,
    },
    method: 'POST',
    url: TW_ACCESS_TOKEN_URL,
  };

  const resp = await fetch(requestData.url, {
    // @ts-expect-error ...
    form: requestData.data,
    headers: {
      ...oauth.toHeader(oauth.authorize(requestData)),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: requestData.method,
  });

  if (resp.status !== 200) throw new Error(resp.statusText);

  return await resp.text();
};

export const verifyCredential = async (key: string, secret: string) => {
  const headers = oauth.toHeader(
    oauth.authorize(
      {
        method: 'GET',
        url: `https://api.twitter.com/1.1/account/verify_credentials.json`,
      },
      {
        key: key,
        secret: secret,
      }
    )
  );

  const resp = await fetch(`https://api.twitter.com/1.1/account/verify_credentials.json`, {
    headers: headers,
  });

  if (resp.status !== 200) {
    throw new Error(resp.statusText);
  }

  return await resp.json();
};

export const updateStatus = async (
  status: string,
  in_reply_to_status_id: string,
  key: string,
  secret: string
) => {
  const requestData = {
    data: {
      in_reply_to_status_id,
      status,
    },
    method: 'POST',
    url: `https://api.twitter.com/1.1/statuses/update.json`,
  };
  const headers = oauth.toHeader(
    oauth.authorize(requestData, {
      key: key,
      secret: secret,
    })
  );

  const resp = await fetch(requestData.url, {
    body: new URLSearchParams(requestData.data).toString(),
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: requestData.method,
  });
  const json = await resp.json();

  if (resp.status === 200) {
    return json;
  } else {
    throw new Error(json.errors[0].message);
  }
};

export async function showStatus(id: string, key?: string, secret?: string) {
  const requestData = {
    method: 'GET',
    url: `https://api.twitter.com/1.1/statuses/show/${id}.json`,
  };
  const headers = oauth.toHeader(
    oauth.authorize(requestData, {
      key: key || TW_ACCESS_KEY,
      secret: secret || TW_ACCESS_SECRET,
    })
  );

  const resp = await fetch(requestData.url, {
    headers: {
      ...headers,
    },
    method: requestData.method,
  });

  if (resp.status !== 200) {
    throw new Error(resp.statusText);
  }

  return await resp.json();
}

export async function getReplies(tweetUrl: string, lastTweetHash?: string): Promise<PostModel[]> {
  const [, , tweetId] = tweetUrl.replace('https://twitter.com/', '').split('/');

  const sinceId = lastTweetHash ? `&since_id=${lastTweetHash}` : '';
  const qs =
    '&max_results=100&expansions=author_id,in_reply_to_user_id&tweet.fields=referenced_tweets,in_reply_to_user_id,author_id,created_at,conversation_id&user.fields=name,username';

  const resp = await fetch(
    `https://api.twitter.com/2/tweets/search/recent?query=conversation_id:${tweetId}${sinceId}${qs}`,
    {
      headers: {
        Authorization: `Bearer ${TW_BEARER_TOKEN}`,
      },
      method: 'GET',
    }
  );

  const json = await resp.json();

  if (json.errors) return [];

  const data = json.data || [];
  const users = (json.includes?.users || []).reduce((acc: any, user: any) => {
    acc[user.id] = user.username;
    return acc;
  }, {});

  return data.map(
    (tweet: {
      author_id: string;
      created_at: string;
      conversation_id: string;
      in_reply_to_user_id: string;
      text: string;
      id: string;
      referenced_tweets: { type: string; id: string }[];
    }): PostModel => {
      const reply = tweet.referenced_tweets.filter(({ type }) => type === 'replied_to')[0];
      return {
        attachment: '',
        content: tweet.text,
        createdAt: new Date(tweet.created_at).getTime(),
        creator: users[tweet.author_id] || tweet.author_id,
        hash: tweet.id,
        messageId: tweet.id,
        reference: reply ? reply.id : tweetId,
        subtype: '',
        title: '',
        topic: '',
        type: '@TWEET@',
      };
    }
  );
}

export async function getUser(username: string): Promise<{
  id: string;
  name: string;
  username: string;
  profile_image_url: string;
} | null> {
  const qs = '?user.fields=name,username,profile_image_url';

  const resp = await fetch(`https://api.twitter.com/2/users/by/username/${username}${qs}`, {
    headers: {
      Authorization: `Bearer ${TW_BEARER_TOKEN}`,
    },
    method: 'GET',
  });

  const json = await resp.json();
  if (json.errors) return null;

  return json.data;
}

export async function getBotometerScore(username: string): Promise<any> {
  const res = await botometer.getScore(username);
  return res?.display_scores?.universal?.overall || 5;
}

export async function getTwitterUserMetrics(userId: string) {
  const res = await fetch(
    `https://api.twitter.com/2/users/${userId}?user.fields=public_metrics,verified`,
    {
      headers: { Authorization: `Bearer ${TW_BEARER_TOKEN}` },
      method: 'GET',
    }
  );

  const {
    data: {
      public_metrics: { followers_count: followers },
      verified: verifiedProfile,
    },
  } = await res.json();

  return { followers, verifiedProfile };
}
