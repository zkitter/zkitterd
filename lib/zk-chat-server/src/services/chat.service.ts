import {GenericService} from "../utils/svc";
import {RLNFullProof} from "@zk-kit/protocols";

export enum ChatMessageType {
    DIRECT = 'DIRECT',
    PUBLIC_ROOM = 'PUBLIC_ROOM',
    PRIVATE_ROOM = 'PRIVATE_ROOM',
}

export type DirectChatMessage = {
    messageId: string;
    timestamp: Date;
    type: ChatMessageType.DIRECT;
    sender: string;
    pubkey?: string;
    rln?: RLNFullProof & {
        epoch: number;
        x_share: string;
    };
    receiver: string;
    ciphertext: string;
    content?: string;
    reference?: string;
    attachment?: string;
}

export type PublicRoomChatMessage = {
    messageId: string;
    timestamp: Date;
    type: ChatMessageType.PUBLIC_ROOM;
    sender: string;
    rln?: RLNFullProof & {
        epoch: number;
        x_share: string;
    };
    receiver: string;
    content: string;
    reference: string;
    attachment: string;
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