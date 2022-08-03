import {ChatMessage, ChatMessageType} from "../services/chat.service";
import crypto from "crypto";
import {RLNFullProof} from "@zk-kit/protocols";

export const validateChatMessage = async (chatMessage: any): Promise<boolean> => {
    assert(chatMessage.timestamp.getTime() > 0);
    assert(chatMessage.receiver);
    assert(chatMessage.messageId === await deriveMessageId(chatMessage));

    if (!chatMessage.sender) {
        assert(chatMessage.rln);
    }

    if (chatMessage.type === 'DIRECT') {
        if (!chatMessage.sender) {
            assert(chatMessage.pubkey);
        }

        return true;
    }

    if (chatMessage.type === 'PUBLIC_ROOM') {
        assert(!chatMessage.ciphertext);
        return true;
    }

    return false;
}

export const deriveMessageId = async (chatMessage: ChatMessage): Promise<string> => {
    let data = '';
    data += chatMessage.type;
    data += chatMessage.timestamp;
    data += chatMessage.sender;

    if (chatMessage.rln) {
        data += JSON.stringify(chatMessage.rln)
    }

    data += chatMessage.receiver;

    if (chatMessage.type === 'DIRECT') {
        data += chatMessage.pubkey || '';
        data += chatMessage.ciphertext;
    }

    if (chatMessage.type === 'PUBLIC_ROOM') {
        data += chatMessage.content;
        data += chatMessage.reference;
        data += chatMessage.attachment;
    }

    return crypto.createHash('sha256').update(data).digest('hex');
}

export const createChatMessage = async (opts: {
    type: 'DIRECT' | 'PUBLIC_ROOM',
    sender: string;
    timestamp?: Date;
    pubkey?: string;
    receiver: string;
    content?: string;
    reference?: string;
    attachment?: string;
    rln?: RLNFullProof & {
        epoch: number;
        x_share: string;
    };
}): Promise<ChatMessage | null> => {
    let val: ChatMessage;

    switch (opts.type) {
        case 'DIRECT':
            val = {
                messageId: '',
                type: ChatMessageType.DIRECT,
                timestamp: opts.timestamp || new Date(),
                sender: opts.sender,
                pubkey: opts.pubkey,
                receiver: opts.receiver,
                rln: opts.rln,
                ciphertext: '',
            };
            val.messageId = await deriveMessageId(val);
            return val;
        default:
            return null;
    }
}

function assert(data: any) {
    if (!data) throw new Error(`cannot be null`);
}