import {GenericService} from "../utils/svc";
import {RLNFullProof} from "@zk-kit/protocols";

export enum ChatMessageType {
    DIRECT = 'DIRECT',
    PUBLIC_ROOM = 'PUBLIC_ROOM',
    PRIVATE_ROOM = 'PRIVATE_ROOM',
}

export enum SenderType {
    KNOWN = 'KNOWN',
    RLN = 'RLN',
}

export type KnownSender = {
    pubkey: string;
}

export type RLNSender = {
    ekey?: string;
    rln: RLNFullProof & {
        epoch: number;
        x_share: string;
    };
}

type EncryptedContent = {
    data: string;
}

type DecryptedContent = {
    content: string;
    reference: string;
    attachment: string;
}

export type DirectChatMessage = {
    messageId: string;
    type: ChatMessageType.DIRECT;
    sender: KnownSender | RLNSender;
    receiver: string;
    payload:  EncryptedContent | DecryptedContent;
}

export type PublicRoomChatMessage = {
    messageId: string;
    type: ChatMessageType.PUBLIC_ROOM;
    sender: KnownSender | RLNSender;
    receiver: string;
    payload:  DecryptedContent;
}

export type ChatMessage = DirectChatMessage | PublicRoomChatMessage;

export default class ChatService extends GenericService {
    addNewMessage = async (chatMessage: ChatMessage) => {
        switch (chatMessage.type) {
            case ChatMessageType.DIRECT:
                return;
            case ChatMessageType.PUBLIC_ROOM:
                return;
        }
    }
}