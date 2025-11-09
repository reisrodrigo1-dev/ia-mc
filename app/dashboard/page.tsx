'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { MessageSquare, Sparkles, Users, Zap, Plus, TrendingUp, Clock, Star } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Chat, Agent, Prompt } from '@/types';
import { Timestamp } from 'firebase/firestore';

interface DashboardStats {
  totalChats: number;
  totalAgents: number;
  totalPrompts: number;
  recentChats: Chat[];
}

// Função auxiliar para formatar datas do Firestore
const formatFirestoreDate = (date: any): string => {
  if (!date) return 'Hoje';
  
  try {
    let jsDate: Date;
    
    // Se for um Timestamp do Firestore
    if (date instanceof Timestamp) {
      jsDate = date.toDate();
    } 
    // Se for um objeto com seconds
    else if (date.seconds) {
      jsDate = new Date(date.seconds * 1000);
    }
    // Se já for uma Date
    else if (date instanceof Date) {
      jsDate = date;
    }
    // Se for uma string
    else if (typeof date === 'string') {
      jsDate = new Date(date);
    }
    else {
      return 'Hoje';
    }

    // Verificar se a data é válida
    if (isNaN(jsDate.getTime())) {
      return 'Hoje';
    }

    const now = new Date();
    const diffTime = Math.abs(now.getTime() - jsDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays} dias atrás`;
    
    return jsDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch (error) {
    console.error('Erro ao formatar data:', error);
    return 'Hoje';
  }
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalChats: 0,
    totalAgents: 0,
    totalPrompts: 0,
    recentChats: []
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Carregar estatísticas do usuário
  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        setLoadingStats(true);
        console.log('📊 Carregando estatísticas para usuário:', user.id);

        // Buscar chats do usuário (proprietário ou com permissão)
        const chatsQuery = query(
          collection(db, 'chats'),
          where('ownerId', '==', user.id)
        );
        const chatsSnapshot = await getDocs(chatsQuery);
        const totalChats = chatsSnapshot.size;
        console.log('💬 Total de chats:', totalChats);

        // Buscar chats recentes
        const recentChatsQuery = query(
          collection(db, 'chats'),
          where('ownerId', '==', user.id),
          orderBy('updatedAt', 'desc'),
          limit(3)
        );
        const recentChatsSnapshot = await getDocs(recentChatsQuery);
        const recentChats = recentChatsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Chat[];
        console.log('📝 Chats recentes:', recentChats.length);

        // Buscar agentes do usuário
        const agentsQuery = query(
          collection(db, 'agents'),
          where('ownerId', '==', user.id)
        );
        const agentsSnapshot = await getDocs(agentsQuery);
        const totalAgents = agentsSnapshot.size;
        console.log('🤖 Total de agentes:', totalAgents);

        // Buscar prompts do usuário
        const promptsQuery = query(
          collection(db, 'prompts'),
          where('ownerId', '==', user.id)
        );
        const promptsSnapshot = await getDocs(promptsQuery);
        const totalPrompts = promptsSnapshot.size;
        console.log('📋 Total de prompts:', totalPrompts);

        setStats({
          totalChats,
          totalAgents,
          totalPrompts,
          recentChats
        });
      } catch (error) {
        console.error('❌ Erro ao carregar estatísticas:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    if (user) {
      fetchStats();
    }
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mb-4 mx-auto">
            <Sparkles className="w-8 h-8 text-white animate-pulse" />
          </div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-orange-50 to-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Assistente IA</h1>
                <p className="text-gray-600 text-sm">Bem-vindo de volta, {user.name}!</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Sistema Online</div>
              <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mt-1"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Welcome Hero */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-2xl p-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2">Olá, {user.name}! 👋</h2>
              <p className="text-orange-100 text-lg">Pronto para aumentar sua produtividade hoje?</p>
            </div>
            <div className="hidden md:block">
              <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {loadingStats ? '...' : stats.totalChats}
                </div>
                <div className="text-gray-600 text-sm">Conversas</div>
              </div>
            </div>
            <div className="text-gray-500 text-xs">
              Total de conversas criadas
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {loadingStats ? '...' : stats.totalAgents}
                </div>
                <div className="text-gray-600 text-sm">Agentes</div>
              </div>
            </div>
            <div className="text-gray-500 text-xs">
              Assistentes personalizados
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Star className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {loadingStats ? '...' : stats.totalPrompts}
                </div>
                <div className="text-gray-600 text-sm">Prompts</div>
              </div>
            </div>
            <div className="text-gray-500 text-xs">
              Templates salvos
            </div>
          </div>
        </div>

        {/* Main Actions */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">O que você quer fazer hoje?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

              <Link
                href="/dashboard/new"
                className="group bg-white rounded-2xl p-6 border border-gray-200 hover:border-orange-300 hover:shadow-xl transition-all transform hover:scale-105"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-lg">
                    <Plus className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-gray-900">Nova Conversa</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Converse com a IA e obtenha ajuda nas suas tarefas
                  </p>
                  <div className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-4 rounded-xl transition-colors">
                    Começar Agora
                  </div>
                </div>
              </Link>

              <Link
                href="/dashboard/agents"
                className="group bg-white rounded-2xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all transform hover:scale-105"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-lg">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-gray-900">Agentes IA</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Assistentes especializados para diferentes tarefas
                  </p>
                  <div className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl transition-colors">
                    Explorar
                  </div>
                </div>
              </Link>

              <Link
                href="/dashboard/prompts"
                className="group bg-white rounded-2xl p-6 border border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all transform hover:scale-105"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-lg">
                    <MessageSquare className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-gray-900">Prompts Salvos</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Seus templates e comandos salvos
                  </p>
                  <div className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-xl transition-colors">
                    Ver Biblioteca
                  </div>
                </div>
              </Link>

              <Link
                href="/dashboard/sectors"
                className="group bg-white rounded-2xl p-6 border border-gray-200 hover:border-green-300 hover:shadow-xl transition-all transform hover:scale-105"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-lg">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-gray-900">Gerenciar Setores</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Organize equipes e permissões
                  </p>
                  <div className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-xl transition-colors">
                    Administrar
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Activity & Tips */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
              <h3 className="font-bold text-xl mb-6 text-gray-900">Atividade Recente</h3>
              {loadingStats ? (
                <div className="text-center py-8 text-gray-500">Carregando...</div>
              ) : stats.recentChats.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Nenhuma conversa ainda</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Comece criando sua primeira conversa!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stats.recentChats.map((chat) => (
                    <Link
                      key={chat.id}
                      href={`/dashboard/new?chatId=${chat.id}`}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{chat.title}</p>
                        <p className="text-sm text-gray-600">
                          {chat.lastMessage ? chat.lastMessage.substring(0, 60) + '...' : 'Nova conversa'}
                        </p>
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatFirestoreDate(chat.lastMessageAt || chat.updatedAt || chat.createdAt)}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tips & CTA */}
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="w-6 h-6" />
                <h3 className="font-bold text-lg">Dica Rápida</h3>
              </div>
              <p className="text-orange-100 text-sm leading-relaxed mb-4">
                Use agentes personalizados para obter respostas específicas para suas tarefas diárias e aumente sua produtividade.
              </p>
              <Link 
                href="/dashboard/agents"
                className="inline-block bg-white text-orange-600 font-semibold py-2 px-4 rounded-xl hover:bg-orange-50 transition-colors"
              >
                Ver Agentes
              </Link>
            </div>

            {user?.role === 'super_admin' && (
              <div className="bg-blue-600 text-white rounded-2xl p-6">
                <h3 className="font-bold text-lg mb-3">Painel Admin</h3>
                <p className="text-blue-100 text-sm mb-4">
                  Gerencie setores, usuários e permissões da plataforma.
                </p>
                <Link 
                  href="/dashboard/sectors"
                  className="inline-block bg-white text-blue-600 font-semibold py-2 px-4 rounded-xl hover:bg-blue-50 transition-colors"
                >
                  Gerenciar Setores
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
