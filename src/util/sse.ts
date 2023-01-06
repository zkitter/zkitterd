import { Response } from 'express';

type SSEClient = {
  res: Response;
  lastUsed: number;
};

const CLIENT_CACHE: {
  [clientId: string]: SSEClient;
} = {};

const TOPIC_MAP: {
  [topic: string]: {
    [clientId: string]: boolean;
  };
} = {};

const MAX_TTL = 2 * 60 * 1000;

let pruneTimeout: any;

export enum SSEType {
  INIT = 'INIT',
  NEW_CHAT_MESSAGE = 'NEW_CHAT_MESSAGE',
  UPDATE_UNREAD = 'UPDATE_UNREAD',
  HEALTHCHECK = 'HEALTHCHECK',
}

export const addConnection = (clientId: string, res: Response) => {
  CLIENT_CACHE[clientId] = {
    lastUsed: Date.now(),
    res,
  };

  const raw = `data: ${JSON.stringify({
    clientId,
    type: SSEType.INIT,
  })}\n\n`;

  res.write(raw);
};

export const keepAlive = (clientId: string) => {
  const client = CLIENT_CACHE[clientId];

  if (!client) throw new Error(`${clientId} not found`);

  client.lastUsed = Date.now();
};

export const addTopic = (clientId: string, topic: string) => {
  const client = CLIENT_CACHE[clientId];

  if (!client) {
    throw new Error(`${clientId} not found`);
  }

  const bucket: { [id: string]: boolean } = TOPIC_MAP[topic] || {};
  bucket[clientId] = true;
  TOPIC_MAP[topic] = bucket;
};
export const publishTopic = async (topic: string, data: any) => {
  const bucket: { [id: string]: boolean } = TOPIC_MAP[topic] || {};

  for (const clientId in bucket) {
    const client = CLIENT_CACHE[clientId];
    if (!client) {
      delete bucket[clientId];
    } else {
      const raw = `data: ${JSON.stringify(data)}\n\n`;
      client.res.write(raw);
    }
  }
};
export const removeConnection = (clientId: string) => {
  const client = CLIENT_CACHE[clientId];

  if (!client) return;

  delete CLIENT_CACHE[clientId];

  client.res.end();
};

export const pruneConnections = async () => {
  const now = Date.now();
  for (const clientId in CLIENT_CACHE) {
    const client = CLIENT_CACHE[clientId];
    if (now - client.lastUsed > MAX_TTL) {
      removeConnection(clientId);
      for (const topic in TOPIC_MAP) {
        const bucket = TOPIC_MAP[topic];
        if (bucket[clientId]) delete bucket[clientId];
      }
    }
  }
};

const pruneLoop = async () => {
  if (pruneTimeout) {
    clearTimeout(pruneTimeout);
  }

  await pruneConnections();

  setTimeout(pruneLoop, MAX_TTL);
};

pruneLoop();
