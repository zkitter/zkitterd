export {};

declare global {
  namespace Express {
    export interface Request {
      redirectUrl: string;
    }

    export interface User {
      userId: string
    }
  }
}
