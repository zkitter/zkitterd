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
        // @ts-ignore
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
function assert(data: any) {
    if (!data) throw new Error(`cannot be null`);
}