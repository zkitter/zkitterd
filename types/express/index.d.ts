export {};

declare global {
  namespace Express {
    export interface Request {
      redirectUrl: string;
    }
  }
}
