import { io, Socket } from "socket.io-client";
import { FEED_TYPES } from "../../constants";
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
    this.socket?.on(FEED_TYPES.JOB_INVITE, handler);
  }

  onJobReview(handler: (review: Record<string, any>) => void): void {
    this.socket?.on(FEED_TYPES.JOB_REVIEW, handler);
  }

  onPaymentReleased(handler: (event: Record<string, any>) => void): void {
    this.socket?.on(FEED_TYPES.JOB_PAYMENT_RELEASED, handler);
  }

  onJobCompleted(handler: (event: Record<string, any>) => void): void {
    this.socket?.on(FEED_TYPES.JOB_COMPLETION, handler);
  }

  onJobApplicationAccepted(handler: (event: Record<string, any>) => void): void {
    this.socket?.on(FEED_TYPES.JOB_APPLICATION_ACCEPTED, handler);
  }

  onJobApplied(handler: (event: Record<string, any>) => void): void {
    this.socket?.on(FEED_TYPES.JOB_APPLIED, handler);
  }

  sendMessage(payload: SendMessagePayload): void {
    this.socket?.emit("SEND_MESSAGE", payload);
  }

  setTyping(conversationId: string, typing: boolean): void {
    const event = typing ? "SENDER_IS_TYPING" : "SENDER_STOPS_TYPING";
    this.socket?.emit(event, { conversationId });
  }

  async loadConversations(): Promise<Conversation[]> {
    const data: WsEnvelope<{ messages: Conversation[] }> =
      await this.socket!.timeout(10_000).emitWithAck("GET_ALL_CONVERSATIONS", {});
    return data.data?.messages ?? [];
  }

  async createDirectConversation(recipientId: string): Promise<Conversation> {
    const data: WsEnvelope<{ conversation: Conversation }> =
      await this.socket!.timeout(10_000).emitWithAck("INITIALIZE_CONVERSATION", {
        type: "DIRECT",
        recipientId,
      });
    if (data.error) throw new Error(data.message);
    return data.data.conversation;
  }

  async createGroupConversation(
    recipientIds: string[],
    name?: string
  ): Promise<Conversation> {
    const recipients = recipientIds.map((id) => ({ user: id, role: "USER" }));
    const data: WsEnvelope<{ conversation: Conversation }> =
      await this.socket!.timeout(10_000).emitWithAck("INITIALIZE_CONVERSATION", {
        type: "GROUP",
        recipients,
        name,
      });
    if (data.error) throw new Error(data.message);
    return data.data.conversation;
  }

  async fetchConversation(conversationId: string): Promise<FetchedConversation> {
    const data: WsEnvelope<FetchedConversation> =
      await this.socket!.timeout(10_000).emitWithAck("FETCH_CONVERSATION_MESSAGES", {
        conversationId,
      });
    if (data.error) throw new Error(data.message);
    return data.data;
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
