'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { 
  collection, 
  getDocs, 
  query, 
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { WhatsAppConnection, WhatsAppChat, WhatsAppMessage } from '@/types';
import { 
  BarChart3,
  MessageCircle,
  Users,
  Clock,
  TrendingUp,
  Activity,
  Loader2
} from 'lucide-react';

interface Analytics {
  totalChats: number;
  activeChats: number;
  totalMessages: number;
  aiMessages: number;
  humanMessages: number;
  avgResponseTime: number;
  todayChats: number;
  todayMessages: number;
}

export default function WhatsAppAnalyticsPage() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [analytics, setAnalytics] = useState<Analytics>({
    totalChats: 0,
    activeChats: 0,
    totalMessages: 0,
    aiMessages: 0,
    humanMessages: 0,
    avgResponseTime: 0,
    todayChats: 0,
    todayMessages: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConnections();
  }, [user]);

  useEffect(() => {
    if (selectedConnectionId) {
      loadAnalytics();
    }
  }, [selectedConnectionId]);

  const loadConnections = async () => {
    if (!user) return;
    
    try {
      const connectionsRef = collection(db, 'whatsapp_connections');
      const q = query(
        connectionsRef,
        where('ownerId', '==', user.uid || user.id),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const loadedConnections = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WhatsAppConnection[];

      setConnections(loadedConnections);
      
      if (loadedConnections.length > 0 && !selectedConnectionId) {
        setSelectedConnectionId(loadedConnections[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar conexões:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    if (!selectedConnectionId) return;

    try {
      // Load chats
      const chatsRef = collection(db, 'whatsapp_chats');
      const chatsQuery = query(
        chatsRef,
        where('connectionId', '==', selectedConnectionId)
      );
      const chatsSnapshot = await getDocs(chatsQuery);
      const chats = chatsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as WhatsAppChat[];

      // Load messages
      const messagesRef = collection(db, 'whatsapp_messages');
      const messagesQuery = query(
        messagesRef,
        where('connectionId', '==', selectedConnectionId)
      );
      const messagesSnapshot = await getDocs(messagesQuery);
      const messages = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as WhatsAppMessage[];

      // Calculate analytics
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayChats = chats.filter(chat => {
        if (!chat.createdAt) return false;
        const createdAt = (chat.createdAt as any).toDate 
          ? (chat.createdAt as any).toDate() 
          : new Date(chat.createdAt as any);
        return createdAt >= today;
      }).length;

      const todayMessages = messages.filter(msg => {
        if (!msg.timestamp) return false;
        const timestamp = (msg.timestamp as any).toDate 
          ? (msg.timestamp as any).toDate() 
          : new Date(msg.timestamp as any);
        return timestamp >= today;
      }).length;

      setAnalytics({
        totalChats: chats.length,
        activeChats: chats.filter(c => c.status === 'active').length,
        totalMessages: messages.length,
        aiMessages: messages.filter(m => !m.isFromMe && m.from === 'bot').length,
        humanMessages: messages.filter(m => m.isFromMe).length,
        avgResponseTime: 0, // TODO: Calculate based on message timestamps
        todayChats,
        todayMessages,
      });
    } catch (error) {
      console.error('Erro ao carregar analytics:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma conexão encontrada</h3>
          <p className="text-gray-600">Crie uma conexão do WhatsApp para visualizar as estatísticas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics WhatsApp</h1>
          <p className="text-gray-600 mt-1">Acompanhe o desempenho das suas conversas</p>
        </div>
        
        <select
          value={selectedConnectionId}
          onChange={(e) => setSelectedConnectionId(e.target.value)}
          className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        >
          {connections.map((conn) => (
            <option key={conn.id} value={conn.id}>
              {conn.name}
            </option>
          ))}
        </select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <MessageCircle className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-xs text-gray-500">Total</span>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{analytics.totalChats}</h3>
          <p className="text-sm text-gray-600">Conversas</p>
          <div className="mt-3 flex items-center text-xs text-green-600">
            <TrendingUp className="w-3 h-3 mr-1" />
            {analytics.todayChats} hoje
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Activity className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-xs text-gray-500">Ativas</span>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{analytics.activeChats}</h3>
          <p className="text-sm text-gray-600">Conversas Ativas</p>
          <div className="mt-3 text-xs text-gray-500">
            {analytics.totalChats > 0 
              ? `${((analytics.activeChats / analytics.totalChats) * 100).toFixed(0)}%`
              : '0%'
            } do total
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <MessageCircle className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-xs text-gray-500">Mensagens</span>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{analytics.totalMessages}</h3>
          <p className="text-sm text-gray-600">Total de Mensagens</p>
          <div className="mt-3 flex items-center text-xs text-green-600">
            <TrendingUp className="w-3 h-3 mr-1" />
            {analytics.todayMessages} hoje
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-xs text-gray-500">Tempo Médio</span>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">
            {analytics.avgResponseTime}s
          </h3>
          <p className="text-sm text-gray-600">Resposta</p>
          <div className="mt-3 text-xs text-gray-500">
            Em breve disponível
          </div>
        </div>
      </div>

      {/* Message Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribuição de Mensagens</h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Mensagens da IA</span>
                <span className="text-sm font-semibold text-gray-900">{analytics.aiMessages}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full"
                  style={{ 
                    width: `${analytics.totalMessages > 0 
                      ? (analytics.aiMessages / analytics.totalMessages) * 100 
                      : 0}%` 
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Mensagens Manuais</span>
                <span className="text-sm font-semibold text-gray-900">{analytics.humanMessages}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-orange-600 h-2 rounded-full"
                  style={{ 
                    width: `${analytics.totalMessages > 0 
                      ? (analytics.humanMessages / analytics.totalMessages) * 100 
                      : 0}%` 
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Recebidas</span>
                <span className="text-sm font-semibold text-gray-900">
                  {analytics.totalMessages - analytics.aiMessages - analytics.humanMessages}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ 
                    width: `${analytics.totalMessages > 0 
                      ? ((analytics.totalMessages - analytics.aiMessages - analytics.humanMessages) / analytics.totalMessages) * 100 
                      : 0}%` 
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status das Conversas</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-600 rounded-full" />
                <span className="text-sm font-medium text-gray-900">Ativas</span>
              </div>
              <span className="text-xl font-bold text-green-600">{analytics.activeChats}</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-yellow-600 rounded-full" />
                <span className="text-sm font-medium text-gray-900">Aguardando</span>
              </div>
              <span className="text-xl font-bold text-yellow-600">
                {analytics.totalChats - analytics.activeChats}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-gray-600 rounded-full" />
                <span className="text-sm font-medium text-gray-900">Fechadas</span>
              </div>
              <span className="text-xl font-bold text-gray-600">0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Atividade Recente</h3>
        
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Gráficos de atividade em breve</p>
          <p className="text-sm text-gray-500 mt-1">Visualize tendências de mensagens ao longo do tempo</p>
        </div>
      </div>
    </div>
  );
}
