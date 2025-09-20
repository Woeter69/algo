// Type definitions for the chat application

export interface ChatData {
  currentUserId: number;
  otherUserId: number;
  otherUserName: string;
  otherUserPfp: string;
}

export interface MessageData {
  sender_id: number;
  receiver_id: number;
  content: string;
  created_at: string;
  sender_username?: string;
  sender_pfp?: string;
  client_message_id?: string;
}

export interface UserStatusData {
  user_id: number;
  is_online: boolean;
}

export interface JoinRoomData {
  user1: number;
  user2: number;
}

// Extend Window interface to include our chat data
declare global {
  interface Window {
    chatData: ChatData;
  }
}

// Socket.IO event types
export interface ServerToClientEvents {
  receive_message: (data: MessageData) => void;
  user_status_changed: (data: UserStatusData) => void;
  user_typing: (data: { user_id: number }) => void;
  user_stopped_typing: (data: { user_id: number }) => void;
}

export interface ClientToServerEvents {
  send_message: (data: {
    sender_id: number;
    receiver_id: number;
    message: string;
    client_message_id: string;
  }) => void;
  user_online: (data: { user_id: number }) => void;
  join: (data: JoinRoomData) => void;
  typing: (data: { user_id: number; receiver_id: number }) => void;
  stop_typing: (data: { user_id: number; receiver_id: number }) => void;
}
