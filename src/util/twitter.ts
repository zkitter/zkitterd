import crypto from "crypto";
import {URLSearchParams} from "url";
const OAuth = require('oauth-1.0a');

const TW_REQ_TOKEN_URL = 'https://api.twitter.com/oauth/request_token'
const TW_AUTH_URL = 'https://api.twitter.com/oauth/authenticate'
const TW_ACCESS_TOKEN_URL = 'https://api.twitter.com/oauth/access_token'
const TW_CALLBACK_URL = 'http://127.0.0.1:3000/twitter/callback';
const TW_CONSUMER_KEY = '7LMfRtYmWztFPq4t2RPMROa0Q';
const TW_CONSUMER_SECRET = 'Knsv5ZqWQk37IW6P3RsVCRJ3PvOKnxJTrAmcJ88D4WbgxY7F43';
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