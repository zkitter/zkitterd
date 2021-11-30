import crypto from "crypto";
import {URLSearchParams} from "url";
import {PostModel} from "../models/posts";
const OAuth = require('oauth-1.0a');

const TW_REQ_TOKEN_URL = 'https://api.twitter.com/oauth/request_token'
const TW_AUTH_URL = 'https://api.twitter.com/oauth/authenticate'
const TW_ACCESS_TOKEN_URL = 'https://api.twitter.com/oauth/access_token'
const TW_CALLBACK_URL = 'http://127.0.0.1:3000/twitter/callback';
const TW_CONSUMER_KEY = '7LMfRtYmWztFPq4t2RPMROa0Q';
const TW_CONSUMER_SECRET = 'Knsv5ZqWQk37IW6P3RsVCRJ3PvOKnxJTrAmcJ88D4WbgxY7F43';
const TW_BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAADLVWAEAAAAAKNNON%2FM6n0ig1OO%2FTavJCJZYLkI%3DYN0uoMG2hzjPnkYSGymvN01DErXc65BQQ7yNKcF3tdM71zqDG6';
const TW_ACCESS_KEY = '1322027810559463425-eN8clVmaaXOwVuHmFPDI4Wo6QKF812';
const TW_ACCESS_SECRET = 'etsUjiQIxeJf7ikgIaWLtpBk1S1zawVtzV0BcMIKZjEXA';

const oauth = OAuth({
    consumer: {
        key: TW_CONSUMER_KEY,
        secret: TW_CONSUMER_SECRET,
    },
    signature_method: 'HMAC-SHA1',
    hash_function: (baseString: string, key: string) => {
        return crypto.createHmac('sha1', key).update(baseString).digest('base64')
    },
});

export async function showStatus(id: string, key?: string, secret?: string) {
    const requestData = {
        url: `https://api.twitter.com/1.1/statuses/show/${id}.json`,
        method: 'GET',
    };
    const headers = oauth.toHeader(oauth.authorize(requestData, {
        key: key || TW_ACCESS_KEY,
        secret: secret || TW_ACCESS_SECRET,
    }));

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
    const [__, _, tweetId] = tweetUrl
        .replace('https://twitter.com/', '')
        .split('/');

    const sinceId = lastTweetHash ? `&since_id=${lastTweetHash}` : '';
    const qs = '&max_results=100&expansions=author_id,in_reply_to_user_id&tweet.fields=referenced_tweets,in_reply_to_user_id,author_id,created_at,conversation_id&user.fields=name,username';

    // @ts-ignore
    const resp = await fetch(
        `https://api.twitter.com/2/tweets/search/recent?query=conversation_id:${tweetId}${sinceId}${qs}`,
        {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${TW_BEARER_TOKEN}`,
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

    return data.map((tweet: {
        author_id: string;
        created_at: string;
        coversation_id: string;
        in_reply_to_user_id: string;
        text: string;
        id: string;
        referenced_tweets: {type: string; id: string}[],
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
    });
}

export async function getUser(username: string): Promise<{
    id: string;
    name: string;
    username: string;
    profile_image_url: string;
}|null> {
    const qs = '?user.fields=name,username,profile_image_url';

    // @ts-ignore
    const resp = await fetch(
        `https://api.twitter.com/2/users/by/username/${username}${qs}`,
        {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${TW_BEARER_TOKEN}`,
            },
        }
    );

    const json = await resp.json();
    if (json.errors) return null;

    return json.data;
}