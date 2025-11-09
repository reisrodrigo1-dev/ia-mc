import { Timestamp } from 'firebase/firestore';

export type UserRole = 'super_admin' | 'sector_admin' | 'user';
export type Visibility = 'private' | 'sector' | 'global';
export type MessageRole = 'user' | 'assistant' | 'system';

export interface User {
  id: string;
  uid?: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  sectorId: string | null;
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface Sector {
  id: string;
  name: string;
  description: string;
  color?: string;
  members: string[];
  adminIds: string[];
  createdById: string;
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface Chat {
  id: string;
  title: string;
  visibility: 'private' | 'sector';
  ownerId: string;
  ownerName?: string;
  sectorId: string | null;
  sectorName?: string;
  allowedUsers: string[];
  agentId?: string;
  promptId?: string | null;
  promptTitle?: string;
  promptContent?: string;
  lastMessage?: string;
  lastMessageAt?: Date | Timestamp;
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface Message {
  id: string;
  chatId: string;
  role: MessageRole;
  content: string;
  userId: string;
  userName?: string;
  timestamp: Date | Timestamp;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens?: number;
  visibility: Visibility;
  ownerId: string;
  ownerName?: string;
  sectorId: string | null;
  allowedUsers: string[];
  icon?: string;
  color?: string;
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface Prompt {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  visibility: Visibility;
  ownerId: string;
  ownerName?: string;
  sectorId: string | null;
  usageCount?: number;
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface WhatsAppConnection {
  id: string;
  name: string;
  phoneNumber?: string | null;
  qrCode?: string | null;
  status: 'disconnected' | 'connecting' | 'qr-code' | 'connected' | 'error';
  visibility: 'personal' | 'sector';
  ownerId: string;
  ownerName?: string;
  sectorId: string | null;
  lastActivity?: Date | Timestamp;
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface WhatsAppMessage {
  id: string;
  connectionId: string;
  chatId: string;
  from: string;
  to: string;
  message: string;
  isFromMe: boolean;
  timestamp: Date | Timestamp;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'error';
}

export interface WhatsAppTraining {
  id: string;
  connectionId: string;
  type: 'document' | 'qna' | 'prompt' | 'url';
  title: string;
  content: string;
  metadata?: any;
  ownerId: string;
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface WhatsAppChat {
  id: string;
  connectionId: string;
  contactName?: string;
  contactNumber: string;
  lastMessage?: string;
  lastMessageAt?: Date | Timestamp;
  status: 'active' | 'waiting' | 'closed';
  isAiActive: boolean;
  tags?: string[];
  notes?: string;
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

