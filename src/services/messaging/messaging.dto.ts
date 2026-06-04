export type MessageType = "TEXT" | "MEDIA" | "TEXT_MEDIA";

export interface SendMessagePayload {
  conversationId: string;
  type: MessageType;
  message?: string;
  attachments?: string[];
}

// Shape of BROADCAST_MESSAGE — raw ChatMessage document emitted to the conversation room
export interface BroadcastMessage {
  _id: string;
  user: string;          // sender user ID (not populated)
  content?: string;      // message text
  conversation: string;  // conversation ID
  type: string;
  attachments?: string[];
  seen?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationRecipient {
  _id: string;
  firstName: string;
  lastName: string;
  profileImage?: { url: string };
  socket?: { status: "ONLINE" | "AWAY" | "OFFLINE" };
}

export interface ConversationMessage {
  _id: string;
  user: string;
  content?: string;
  conversation: string;
  type: string;
  attachments?: { url: string }[];
  seen?: boolean;
  createdAt: string;
}

export interface Conversation {
  _id: string;
  name?: string;
  type: "DIRECT" | "GROUP";
  recipients: ConversationRecipient[];
  messages: ConversationMessage[];
  isPrivate?: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface FetchedConversation {
  _id: string;
  chats: { messages: ConversationMessage[]; totalMessagesCount: number };
  recipients: ConversationRecipient[];
  createdAt: string;
  updatedAt: string;
}

export interface UserStatusEvent {
  _id: string;
  firstName: string;
  lastName: string;
  status: "ONLINE" | "AWAY" | "OFFLINE";
}

// Internal wsResponse envelope returned by paktsuite socket events
export interface WsEnvelope<T> {
  error: boolean;
  statusCode: number;
  message: string;
  data: T;
}
