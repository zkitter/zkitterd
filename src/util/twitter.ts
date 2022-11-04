import crypto from 'crypto';
import { URLSearchParams } from 'url';
import { PostModel } from '../models/posts';
import config from './config';
const { Botometer } = require('botometer');
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
  consumerKey: TW_CONSUMER_KEY,
  consumerSecret: TW_CONSUMER_SECRET,
  accessToken: TW_ACCESS_KEY,
  accessTokenSecret: TW_ACCESS_SECRET,
  rapidApiKey: config.rapidAPIKey,
  usePro: true,
});

const oauth = OAuth({
  consumer: {
    key: TW_CONSUMER_KEY,
    secret: TW_CONSUMER_SECRET,
  },
  signature_method: 'HMAC-SHA1',
  hash_function: (baseString: string, key: string) => {
    return crypto.createHmac('sha1', key).update(baseString).digest('base64');
  },
});

export const createHeader = (requestData: any, key: string, secret: string) => {
  const headers = oauth.toHeader(
    oauth.authorize(requestData, {
      key: key,
      secret: secret,
    })
  );
  return headers;
};

export const requestToken = async (): Promise<string> => {
  const requestData = {
    url: TW_REQ_TOKEN_URL,
    method: 'POST',
    data: {
      oauth_callbank: TW_CALLBACK_URL,
    },
  };

  const resp = await fetch(requestData.url, {
    method: requestData.method,
    // @ts-ignore
    form: requestData.data,
    headers: {
      ...oauth.toHeader(oauth.authorize(requestData)),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (resp.status !== 200) throw new Error(resp.statusText);

  return await resp.text();
};

export const accessToken = async (token: string, verifier: string, tokenSecret: string) => {
  const requestData = {
    url: TW_ACCESS_TOKEN_URL,
    method: 'POST',
    data: {
      oauth_token: token,
      oauth_verifier: verifier,
      oauth_token_secret: tokenSecret,
    },
  };

  const resp = await fetch(requestData.url, {
    method: requestData.method,
    // @ts-ignore
    form: requestData.data,
    headers: {
      ...oauth.toHeader(oauth.authorize(requestData)),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (resp.status !== 200) throw new Error(resp.statusText);

  return await resp.text();
};

export const verifyCredential = async (key: string, secret: string) => {
  const headers = oauth.toHeader(
    oauth.authorize(
      {
        url: `https://api.twitter.com/1.1/account/verify_credentials.json`,
        method: 'GET',
      },
      {
        key: key,
        secret: secret,
      }
    )
  );

  // @ts-ignore
  const resp = await fetch(`https://api.twitter.com/1.1/account/verify_credentials.json`, {
    headers: headers,
  });

  if (resp.status !== 200) {
    throw new Error(resp.statusText);
  }

  const json = await resp.json();

  return json;
};

export const updateStatus = async (
  status: string,
  in_reply_to_status_id: string,
  key: string,
  secret: string
) => {
  const requestData = {
    url: `https://api.twitter.com/1.1/statuses/update.json`,
    method: 'POST',
    data: {
      status,
      in_reply_to_status_id,
    },
  };
  const headers = oauth.toHeader(
    oauth.authorize(requestData, {
      key: key,
      secret: secret,
    })
  );

  // @ts-ignore
  const resp = await fetch(requestData.url, {
    method: requestData.method,
    body: new URLSearchParams(requestData.data).toString(),
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
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
    url: `https://api.twitter.com/1.1/statuses/show/${id}.json`,
    method: 'GET',
  };
  const headers = oauth.toHeader(
    oauth.authorize(requestData, {
      key: key || TW_ACCESS_KEY,
      secret: secret || TW_ACCESS_SECRET,
    })
  );

  // @ts-ignore
  const resp = await fetch(requestData.url, {
    method: requestData.method,
    headers: {
      ...headers,
    },
  });

  if (resp.status !== 200) {
    throw new Error(resp.statusText);
  }

  const json = await resp.json();

  return json;
}

export async function getReplies(tweetUrl: string, lastTweetHash?: string): Promise<PostModel[]> {
  const [__, _, tweetId] = tweetUrl.replace('https://twitter.com/', '').split('/');

  const sinceId = lastTweetHash ? `&since_id=${lastTweetHash}` : '';
  const qs =
    '&max_results=100&expansions=author_id,in_reply_to_user_id&tweet.fields=referenced_tweets,in_reply_to_user_id,author_id,created_at,conversation_id&user.fields=name,username';

  // @ts-ignore
  const resp = await fetch(
    `https://api.twitter.com/2/tweets/search/recent?query=conversation_id:${tweetId}${sinceId}${qs}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${TW_BEARER_TOKEN}`,
      },
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
      coversation_id: string;
      in_reply_to_user_id: string;
      text: string;
      id: string;
      referenced_tweets: { type: string; id: string }[];
    }): PostModel => {
      const reply = tweet.referenced_tweets.filter(({ type }) => type === 'replied_to')[0];
      return {
        messageId: tweet.id,
        hash: tweet.id,
        creator: users[tweet.author_id] || tweet.author_id,
        type: '@TWEET@',
        subtype: '',
        createdAt: new Date(tweet.created_at).getTime(),
        topic: '',
        title: '',
        content: tweet.text,
        reference: reply ? reply.id : tweetId,
        attachment: '',
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

  // @ts-ignore
  const resp = await fetch(`https://api.twitter.com/2/users/by/username/${username}${qs}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${TW_BEARER_TOKEN}`,
    },
  });

  const json = await resp.json();
  if (json.errors) return null;

  return json.data;
}

export async function getBotometerScore(username: string): Promise<any> {
  return botometer.getScore(username);
}
