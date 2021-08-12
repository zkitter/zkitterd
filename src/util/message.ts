import crypto from "crypto";

export enum MessageType {
    Post = 'POST',
    Moderation = 'MODERATION',
    Connection = 'CONNECTION',
    File = 'FILE',
}

export type MessageOption = {
    type: MessageType;
    creator?: string;
    createdAt?: Date;
}

export class Message {
    type: MessageType;
    creator: string;
    createdAt: Date;

    static getType(type: string): MessageType|null {
        switch (type.toUpperCase()) {
            case 'POST':
                return MessageType.Post;
            case 'CONNECTION':
                return MessageType.Connection;
            case 'FILE':
                return MessageType.File;
            case 'MODERATION':
                return MessageType.Moderation;
            default:
                return null;
        }
    }

    constructor(opt: MessageOption) {
        this.type = opt.type;
        this.creator = opt.creator || '';
        this.createdAt = opt.createdAt || new Date();
    }

    toJSON() {
        throw new Error('toJSON is not implemented');
    }

    toHex() {
        throw new Error('toHex is not implemented');
    }
}

export enum PostMessageSubType {
    Default = '',
    Repost = 'REPOST',
    Reply = 'REPLY',
}

export type PostMessagePayload = {
    topic: string;
    title: string;
    content: string;
    reference: string;
    attachment: string;
};

export type PostJSON = {
    type: MessageType;
    messageId: string;
    hash: string;
    createdAt: number;
    subtype: PostMessageSubType;
    payload: PostMessagePayload;
    meta?: any;
};

export type PostMessageOption = {
    subtype: PostMessageSubType;
    payload: {
        topic?: string;
        title?: string;
        content?: string;
        reference?: string;
        attachment?: string;
    };
} & MessageOption;

export class Post extends Message {
    subtype: PostMessageSubType;

    payload: PostMessagePayload;

    static fromHex(hex: string) {
        let d = hex;

        const [type] = decodeString(d, 2, cb);
        const [subtype] = decodeString(d, 2, cb);
        const [creator] = decodeString(d, 3, cb);
        const [createdAt] = decodeNumber(d, 12, cb);
        const [topic] = decodeString(d, 3, cb);
        const [title] = decodeString(d, 3, cb);
        const [content] = decodeString(d, 6, cb);
        const [reference] = decodeString(d, 3, cb);
        const [attachment] = decodeString(d, 3, cb);

        return new Post({
            type: type as MessageType.Post,
            subtype: subtype as PostMessageSubType,
            creator,
            createdAt: new Date(createdAt),
            payload: {
                topic,
                title,
                content,
                reference,
                attachment,
            }
        });

        function cb(n: number) {
            d = d.slice(n);
        }
    }

    static getSubtype(subtype: string): PostMessageSubType {
        switch (subtype) {
            case '':
                return PostMessageSubType.Default;
            case 'REPLY':
                return PostMessageSubType.Reply;
            case 'REPOST':
                return PostMessageSubType.Repost;
            default:
                return PostMessageSubType.Default;
        }
    }

    constructor(opt: PostMessageOption) {
        super(opt);
        this.type = MessageType.Post;
        this.subtype = Post.getSubtype(opt.subtype);
        this.payload = {
            topic: opt.payload.topic || '',
            title: opt.payload.title || '',
            content: opt.payload.content || '',
            reference: opt.payload.reference || '',
            attachment: opt.payload.attachment || '',
        };
    }

    hash() {
        return crypto.createHash('sha256').update(this.toHex()).digest('hex');
    }

    toJSON(): PostJSON {
        const hash = this.hash();
        return {
            messageId: `${this.creator}/${hash}`,
            hash: hash,
            type: this.type,
            subtype: this.subtype,
            createdAt: this.createdAt.getTime(),
            payload: this.payload,
        };
    }

    toHex() {
        const type = encodeString(this.type, 2);
        const subtype = encodeString(this.subtype, 2);
        const creator = encodeString(this.creator, 3);
        const createdAt = encodeNumber(this.createdAt.getTime(), 12);
        const topic = encodeString(this.payload.topic, 3);
        const title = encodeString(this.payload.title, 3);
        const content = encodeString(this.payload.content, 6);
        const reference = encodeString(this.payload.reference, 3);
        const attachment = encodeString(this.payload.attachment, 3);
        return type + subtype + creator + createdAt + topic + title + content + reference + attachment;
    }
}

export enum ModerationMessageSubType {
    Like = 'LIKE',
    Block = 'BLOCK',
    Default = '',
}

export type ModerationMessagePayload = {
    reference: string;
};

export type ModerationJSON = {
    type: MessageType;
    messageId: string;
    hash: string;
    createdAt: number;
    subtype: ModerationMessageSubType;
    payload: ModerationMessagePayload;
};

export type ModerationMessageOption = {
    subtype: ModerationMessageSubType;
    payload: {
        reference?: string;
    };
} & MessageOption;

export class Moderation extends Message {
    subtype: ModerationMessageSubType;

    payload: ModerationMessagePayload;

    static fromHex(hex: string) {
        let d = hex;

        const [type] = decodeString(d, 2, cb);
        const [subtype] = decodeString(d, 2, cb);
        const [creator] = decodeString(d, 3, cb);
        const [createdAt] = decodeNumber(d, 12, cb);
        const [reference] = decodeString(d, 3, cb);

        return new Moderation({
            type: type as MessageType.Moderation,
            subtype: subtype as ModerationMessageSubType,
            creator,
            createdAt: new Date(createdAt),
            payload: {
                reference,
            }
        });

        function cb(n: number) {
            d = d.slice(n);
        }
    }

    static getSubtype(subtype: string): ModerationMessageSubType {
        switch (subtype) {
            case 'LIKE':
                return ModerationMessageSubType.Like;
            case 'BLOCK':
                return ModerationMessageSubType.Block;
            default:
                return ModerationMessageSubType.Default;
        }
    }

    constructor(opt: ModerationMessageOption) {
        super(opt);
        this.type = MessageType.Moderation;
        this.subtype = Moderation.getSubtype(opt.subtype);
        this.payload = {
            reference: opt.payload.reference || '',
        };
    }

    hash() {
        return crypto.createHash('sha256').update(this.toHex()).digest('hex');
    }

    toJSON(): ModerationJSON {
        const hash = this.hash();
        return {
            messageId: `${this.creator}/${hash}`,
            hash: hash,
            type: this.type,
            subtype: this.subtype,
            createdAt: this.createdAt.getTime(),
            payload: this.payload,
        };
    }

    toHex() {
        const type = encodeString(this.type, 2);
        const subtype = encodeString(this.subtype, 2);
        const creator = encodeString(this.creator, 3);
        const createdAt = encodeNumber(this.createdAt.getTime(), 12);
        const reference = encodeString(this.payload.reference, 3);
        return type + subtype + creator + createdAt + reference;
    }
}

enum ConnectionMessageSubType {
    Follow = 'FOLLOW',
    Block = 'BLOCK',
}

enum ProfileMessageSubType {
    Default = '',
    Custom = 'CUSTOM',
}

enum FileMessageSubType {
    Default = '',
}

function encodeString(str: string, maxBytes: number): string {
    const hex = Buffer.from(str, 'utf-8').toString('hex');
    const len = hex.length;
    const hexlen = len.toString(16).padStart(maxBytes, '0');
    return `${hexlen}${hex}`;
}

function decodeString(data: string, maxBytes: number, cb?: (n: number) => void): [string, number] {
    const lenHex = data.slice(0, maxBytes);
    const len = parseInt(lenHex, 16);
    const str = data.slice(maxBytes, maxBytes + len);
    cb && cb(maxBytes + len);
    return [Buffer.from(str, 'hex').toString('utf-8'), maxBytes + len];
}

function encodeNumber(num: number, maxBytes: number): string {
    return num.toString(16).padStart(maxBytes, '0');
}

function decodeNumber(data: string, maxBytes: number, cb?: (n:number) => void): [number, number] {
    const hex = data.slice(0, maxBytes);
    cb && cb(maxBytes);
    return [parseInt(hex, 16), maxBytes]
}

function decodeHex(data: string, maxBytes: number, cb?: (n:number) => void): [string, number] {
    const hex = data.slice(0, maxBytes);
    cb && cb(maxBytes);
    return [hex, maxBytes]
}

function pad(str: string, len: number) {
    if (str.length >= len) {
        throw new Error(`${len} exceeds max length ${len}`);
    }

    let values = Array(len).fill('0');

    for (let i = str.length - 1; i >= 0; i--) {
        values[len - (str.length - i)] = str[i];
    }

    return values.join('');
}