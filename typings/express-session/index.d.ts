declare module 'express-session' {
  interface SessionData {
    oauth_token_secret: string | string[] | undefined;
    redirectUrl: string | ParsedQs | string[] | ParsedQs[] | undefined;
    twitterToken: string;
  }
}

export {};
