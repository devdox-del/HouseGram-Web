export type MessageType = 'sent' | 'received';

export interface Message {
  id: string;
  type: MessageType;
  text: string;
  time: string;
  status?: 'sending' | 'sent' | 'read';
  audioUrl?: string;
  fileUrl?: string;
  fileName?: string;
  senderId?: string;
  createdAt?: any;
  editedAt?: any;
  chatId?: string;
}

export interface Contact {
  id: string;
  name: string;
  initial: string;
  avatarColor: string;
  avatarUrl?: string;
  statusOnline: string;
  statusOffline: string;
  phone: string;
  bio: string;
  username: string;
  messages: Message[];
  isTyping: boolean;
  unread: number;
  isBlocked?: boolean;
  isChannel?: boolean;
  isOfficial?: boolean;
}

export interface UserProfile {
  name: string;
  username: string;
  bio: string;
  phone: string;
  avatarUrl?: string;
  status?: 'online' | 'offline';
  lastSeen?: any; // Firestore timestamp
  isOfficial?: boolean;
}

export type ViewState = 'menu' | 'chat' | 'profile' | 'settings' | 'chat-settings' | 'features' | 'privacy' | 'notifications' | 'security' | 'admin' | 'auth' | 'info';
