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
  
  // NOVO: Rastreamento de qual IA respondeu
  aiTrainingId?: string; // ID do treinamento que gerou a resposta (se foi IA)
  aiTrainingName?: string; // Nome do treinamento para exibição
}

export interface WhatsAppTraining {
  id: string;
  connectionId: string;
  name: string; // Nome do treinamento (ex: "Atendimento Vendas")
  description?: string; // Descrição do treinamento
  type: 'document' | 'qna' | 'prompt' | 'url';
  title: string;
  content: string;
  metadata?: any;
  
  // NOVO: Sistema de ativação multi-IA
  mode: 'always' | 'keywords'; // Modo de ativação: sempre ou por palavras-chave
  keywords: string[]; // Lista de palavras-chave que ativam esta IA
  keywordsMatchType: 'any' | 'all'; // Qualquer palavra OU todas as palavras
  priority: number; // Prioridade (maior = mais prioritário)
  isActive: boolean; // Se o treinamento está ativo
  
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
  lastActivityAt?: Date | Timestamp; // Última atividade no chat (nova mensagem)
  status: 'active' | 'waiting' | 'closed';
  isAiActive: boolean;
  tags?: string[];
  notes?: string;
  excludedTrainings?: string[]; // IDs dos treinamentos excluídos desta conversa
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

