declare global {
  namespace Express {
    export interface Request {
      token: string;
      auth: { id: string };
    }
  }
}

export {};
