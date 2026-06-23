import { io, Socket } from "socket.io-client";
import type {
  BroadcastMessage,
  Conversation,
  FetchedConversation,
  JobInviteNotification,
  SendMessagePayload,
  UserStatusEvent,
  WsEnvelope,
} from "./messaging.dto";

export class MessagingService {
  private socket: Socket | null = null;

  constructor(
    private readonly messagingUrl: string,
    private readonly token: string
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(this.messagingUrl, {
        transports: ["websocket"],
        auth: { authorization: `Bearer ${this.token}` },
      });
      this.socket.once("connect", () => {
        this.socket!.emit("USER_CONNECT");
        resolve();
      });
      this.socket.once("connect_error", reject);
    });
  }

  // BROADCAST_MESSAGE is emitted to the conversation room with the raw ChatMessage document.
  // The handler receives the message directly (no wsResponse envelope).
  onBroadcast(handler: (msg: BroadcastMessage) => void): void {
    this.socket?.on("BROADCAST_MESSAGE", handler);
  }

  onUserStatus(handler: (event: UserStatusEvent) => void): void {
    this.socket?.on("USER_STATUS", handler);
  }

  onJobInvite(handler: (invite: JobInviteNotification) => void): void {
    this.socket?.on("JOB_INVITE", handler);
  }

  sendMessage(payload: SendMessagePayload): void {
    this.socket?.emit("SEND_MESSAGE", payload);
  }

  setTyping(conversationId: string, typing: boolean): void {
    const event = typing ? "SENDER_IS_TYPING" : "SENDER_STOPS_TYPING";
    this.socket?.emit(event, { conversationId });
  }

  loadConversations(): Promise<Conversation[]> {
    return new Promise((resolve) => {
      this.socket?.emit("GET_ALL_CONVERSATIONS");
      this.socket?.once(
        "GET_ALL_CONVERSATIONS",
        (data: WsEnvelope<{ messages: Conversation[] }>) => {
          resolve(data.data?.messages ?? []);
        }
      );
    });
  }

  createDirectConversation(recipientId: string): Promise<Conversation> {
    return new Promise((resolve, reject) => {
      this.socket?.emit("INITIALIZE_CONVERSATION", {
        type: "DIRECT",
        recipientId,
      });
      this.socket?.once(
        "INITIALIZE_CONVERSATION",
        (data: WsEnvelope<{ conversation: Conversation }>) => {
          if (data.error) {
            reject(new Error(data.message));
          } else {
            resolve(data.data.conversation);
          }
        }
      );
    });
  }

  createGroupConversation(
    recipientIds: string[],
    name?: string
  ): Promise<Conversation> {
    return new Promise((resolve, reject) => {
      const recipients = recipientIds.map((id) => ({ user: id, role: "USER" }));
      this.socket?.emit("INITIALIZE_CONVERSATION", {
        type: "GROUP",
        recipients,
        name,
      });
      this.socket?.once(
        "INITIALIZE_CONVERSATION",
        (data: WsEnvelope<{ conversation: Conversation }>) => {
          if (data.error) {
            reject(new Error(data.message));
          } else {
            resolve(data.data.conversation);
          }
        }
      );
    });
  }

  fetchConversation(conversationId: string): Promise<FetchedConversation> {
    return new Promise((resolve, reject) => {
      this.socket?.emit("FETCH_CONVERSATION_MESSAGES", { conversationId });
      this.socket?.once(
        "FETCH_CONVERSATION_MESSAGES",
        (data: WsEnvelope<FetchedConversation>) => {
          if (data.error) {
            reject(new Error(data.message));
          } else {
            resolve(data.data);
          }
        }
      );
    });
  }

  // paktsuite requires both conversationId and seen (timestamp string) to mark messages read
  markSeen(conversationId: string): void {
    this.socket?.emit("MARK_MESSAGE_AS_SEEN", {
      conversationId,
      seen: Date.now().toString(),
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }
}
