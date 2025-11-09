'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Send, Bot, User as UserIcon, Sparkles, Zap, MessageSquare, Clock, ArrowLeft, Plus, Trash2, Menu, X, Edit2, Check, Users, Lock, Search, Filter, FileText } from 'lucide-react';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: any;
}

interface Chat {
  id: string;
  title: string;
  lastMessage: string;
  lastMessageAt: any;
  createdAt: any;
  ownerId: string;
  ownerName?: string;
  agentId?: string | null;
  agentName?: string;
  promptId?: string | null;
  promptTitle?: string;
  promptContent?: string;
  visibility?: 'private' | 'sector';
  sectorId?: string | null;
}

interface Agent {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  visibility: 'private' | 'sector';
  ownerId: string;
  sectorId?: string | null;
}

export default function NewChatPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [loadingChats, setLoadingChats] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [currentChatVisibility, setCurrentChatVisibility] = useState<'private' | 'sector'>('private');
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'private' | 'sector'>('all');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [appliedPrompt, setAppliedPrompt] = useState<{id: string; title: string; content: string} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Carregar prompt do localStorage se houver
  useEffect(() => {
    const savedPrompt = localStorage.getItem('selectedPrompt');
    if (savedPrompt) {
      try {
        const prompt = JSON.parse(savedPrompt);
        setAppliedPrompt({
          id: prompt.id,
          title: prompt.title,
          content: prompt.content
        });
        localStorage.removeItem('selectedPrompt');
        // Abrir modal de seleção de agente/visibilidade
        setShowAgentModal(true);
      } catch (error) {
        console.error('Erro ao carregar prompt:', error);
      }
    }
  }, []);

  // Load user's chats
  useEffect(() => {
    if (user) {
      loadChats();
      loadAgents();
    }
  }, [user]);

  const loadAgents = async () => {
    if (!user) return;
    
    try {
      // Load user's own agents
      const ownAgentsQuery = query(
        collection(db, 'agents'),
        where('ownerId', '==', user.id),
        orderBy('createdAt', 'desc')
      );
      
      const ownSnapshot = await getDocs(ownAgentsQuery);
      let allAgents = ownSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Agent));
      
      // If user has a sector, also load sector agents
      if (user.sectorId) {
        const sectorAgentsQuery = query(
          collection(db, 'agents'),
          where('visibility', '==', 'sector'),
          where('sectorId', '==', user.sectorId),
          orderBy('createdAt', 'desc')
        );
        
        const sectorSnapshot = await getDocs(sectorAgentsQuery);
        const sectorAgents = sectorSnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Agent));
        
        // Add sector agents that aren't already in the list
        for (const sectorAgent of sectorAgents) {
          if (!allAgents.find(a => a.id === sectorAgent.id)) {
            allAgents.push(sectorAgent);
          }
        }
      }
      
      setAgents(allAgents);
      console.log('🤖 Loaded', allAgents.length, 'agents');
    } catch (error) {
      console.error('❌ Error loading agents:', error);
    }
  };

  const loadChats = async () => {
    if (!user) return;
    
    setLoadingChats(true);
    try {
      console.log('👤 Current user:', user.id, 'Sector:', user.sectorId);
      
      // Load user's own private chats (only chats where user is the owner)
      const ownChatsQuery = query(
        collection(db, 'chats'),
        where('ownerId', '==', user.id),
        orderBy('lastMessageAt', 'desc')
      );
      
      const ownSnapshot = await getDocs(ownChatsQuery);
      let allChats = ownSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Chat));
      
      console.log('📝 Own chats loaded:', allChats.length);
      
      // If user has a sector, also load sector chats (shared with sector)
      if (user.sectorId) {
        console.log('🏢 Loading sector chats for sector:', user.sectorId);
        
        const sectorChatsQuery = query(
          collection(db, 'chats'),
          where('visibility', '==', 'sector'),
          where('sectorId', '==', user.sectorId),
          orderBy('lastMessageAt', 'desc')
        );
        
        const sectorSnapshot = await getDocs(sectorChatsQuery);
        console.log('🏢 Sector chats found:', sectorSnapshot.docs.length);
        
        const sectorChats = sectorSnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Chat));
        
        // Add sector chats that aren't already in the list (avoid duplicates)
        for (const sectorChat of sectorChats) {
          if (!allChats.find(c => c.id === sectorChat.id)) {
            allChats.push(sectorChat);
          }
        }
      } else {
        console.log('⚠️ User has no sector ID');
      }
      
      // Fetch owner names for ALL sector chats
      const uniqueOwnerIds = [...new Set(
        allChats
          .filter(chat => chat.visibility === 'sector')
          .map(chat => chat.ownerId)
      )];
      
      console.log('👥 Fetching names for owners:', uniqueOwnerIds);
      
      const ownerNames: Record<string, string> = {};
      
      for (const ownerId of uniqueOwnerIds) {
        try {
          // Try to get user document directly by ID (most efficient)
          const userDocRef = doc(db, 'users', ownerId);
          const userSnapshot = await getDoc(userDocRef);
          
          if (userSnapshot.exists()) {
            const userData = userSnapshot.data();
            ownerNames[ownerId] = userData.name || 'Usuário';
            console.log('✅ Found name for', ownerId, ':', ownerNames[ownerId]);
          } else {
            // Fallback: try to find by 'id' field
            const userQuery = await getDocs(query(collection(db, 'users'), where('id', '==', ownerId)));
            if (!userQuery.empty) {
              const userData = userQuery.docs[0].data();
              ownerNames[ownerId] = userData.name || 'Usuário';
              console.log('✅ Found name (by id field) for', ownerId, ':', ownerNames[ownerId]);
            } else {
              console.warn('⚠️ No user document found for:', ownerId);
              ownerNames[ownerId] = 'Usuário';
            }
          }
        } catch (err) {
          console.error('❌ Error fetching owner name for:', ownerId, err);
          ownerNames[ownerId] = 'Usuário';
        }
      }
      
      // Add owner names to ALL sector chats (including own chats)
      allChats = allChats.map(chat => ({
        ...chat,
        ownerName: chat.visibility === 'sector' ? ownerNames[chat.ownerId] : undefined
      }));
      
      // Sort by last message time
      allChats.sort((a, b) => {
        const timeA = a.lastMessageAt?.toMillis?.() || 0;
        const timeB = b.lastMessageAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      
      setChats(allChats);
      console.log('📚 Loaded', allChats.length, 'chats');
    } catch (error) {
      console.error('❌ Error loading chats:', error);
    } finally {
      setLoadingChats(false);
    }
  };

  const loadChatMessages = async (chatIdToLoad: string) => {
    if (!user) return;
    
    try {
      console.log('📖 Loading messages for chat:', chatIdToLoad);
      
      // Get chat metadata to check permissions
      const chatToLoad = chats.find(c => c.id === chatIdToLoad);
      
      if (!chatToLoad) {
        console.error('❌ Chat not found');
        return;
      }
      
      // Check if user has permission to view this chat
      const isOwner = chatToLoad.ownerId === user.id;
      const isSectorChat = chatToLoad.visibility === 'sector' && chatToLoad.sectorId === user.sectorId;
      
      if (!isOwner && !isSectorChat) {
        console.error('❌ User does not have permission to view this chat');
        alert('Você não tem permissão para visualizar esta conversa.');
        return;
      }
      
      setCurrentChatVisibility(chatToLoad.visibility || 'private');
      
      // Load prompt if this chat has one
      if (chatToLoad.promptId && chatToLoad.promptTitle && chatToLoad.promptContent) {
        console.log('📋 Carregando prompt do chat:', chatToLoad.promptTitle);
        setAppliedPrompt({
          id: chatToLoad.promptId,
          title: chatToLoad.promptTitle,
          content: chatToLoad.promptContent
        });
      } else {
        setAppliedPrompt(null);
      }
      
      // Load agent if this chat has one
      if (chatToLoad.agentId) {
        console.log('🤖 Loading agent for chat:', chatToLoad.agentId);
        try {
          // Try to get agent document directly by ID (most efficient)
          const agentDocRef = doc(db, 'agents', chatToLoad.agentId);
          const agentSnapshot = await getDoc(agentDocRef);
          
          if (agentSnapshot.exists()) {
            const agentData = agentSnapshot.data();
            const agent: Agent = {
              id: agentSnapshot.id,
              name: agentData.name,
              description: agentData.description,
              systemPrompt: agentData.systemPrompt,
              visibility: agentData.visibility,
              ownerId: agentData.ownerId,
              sectorId: agentData.sectorId
            };
            setSelectedAgent(agent);
            console.log('✅ Agent loaded:', agent.name);
          } else {
            console.warn('⚠️ Agent not found:', chatToLoad.agentId);
            // Use agent info from chat if agent was deleted or not accessible
            if (chatToLoad.agentName) {
              setSelectedAgent({
                id: chatToLoad.agentId,
                name: chatToLoad.agentName,
                description: 'Agente não disponível',
                systemPrompt: '',
                visibility: 'private',
                ownerId: '',
                sectorId: null
              });
              console.log('📝 Using cached agent name:', chatToLoad.agentName);
            } else {
              setSelectedAgent(null);
            }
          }
        } catch (error) {
          console.error('❌ Error loading agent:', error);
          // Use agent info from chat if there's a permission error
          if (chatToLoad.agentName) {
            setSelectedAgent({
              id: chatToLoad.agentId,
              name: chatToLoad.agentName,
              description: 'Agente não acessível',
              systemPrompt: '',
              visibility: 'private',
              ownerId: '',
              sectorId: null
            });
            console.log('📝 Using cached agent name due to error:', chatToLoad.agentName);
          } else {
            setSelectedAgent(null);
          }
        }
      } else {
        setSelectedAgent(null);
      }
      
      const messagesQuery = query(
        collection(db, `chats/${chatIdToLoad}/messages`),
        orderBy('timestamp', 'asc')
      );
      
      const snapshot = await getDocs(messagesQuery);
      const loadedMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          role: data.role,
          content: data.content,
          timestamp: data.timestamp
        } as Message;
      });
      
      setMessages(loadedMessages);
      setChatId(chatIdToLoad);
      console.log('✅ Loaded', loadedMessages.length, 'messages');
    } catch (error) {
      console.error('❌ Error loading messages:', error);
    }
  };

  const createNewChat = () => {
    // Limpar o prompt aplicado apenas se não vier da página de prompts
    if (!appliedPrompt) {
      setShowAgentModal(true);
    } else {
      // Se há prompt aplicado, manter e abrir modal de agente
      setShowAgentModal(true);
    }
  };

  const startNewChatWithAgent = (agent: Agent | null, visibility: 'private' | 'sector') => {
    setMessages([]);
    setChatId(null);
    setInput('');
    setSelectedAgent(agent);
    setCurrentChatVisibility(visibility);
    setShowAgentModal(false);
    setShowVisibilityModal(false);
    // NÃO limpar appliedPrompt aqui - ele deve persistir durante toda a conversa
    console.log('➕ Started new chat with agent:', agent?.name || 'none', 'visibility:', visibility, 'prompt:', appliedPrompt?.title || 'none');
  };

  const startNewChatWithVisibility = (visibility: 'private' | 'sector') => {
    setMessages([]);
    setChatId(null);
    setInput('');
    setCurrentChatVisibility(visibility);
    setShowVisibilityModal(false);
    // NÃO limpar appliedPrompt aqui - ele deve persistir durante toda a conversa
    console.log('➕ Started new chat with visibility:', visibility, 'prompt:', appliedPrompt?.title || 'none');
  };

  const deleteChat = async (chatIdToDelete: string) => {
    if (!user) return;
    
    // Check if user owns this chat
    const chatToDelete = chats.find(c => c.id === chatIdToDelete);
    if (!chatToDelete) return;
    
    if (chatToDelete.ownerId !== user.id) {
      alert('Apenas o criador pode excluir esta conversa.');
      return;
    }
    
    if (!confirm('Tem certeza que deseja excluir esta conversa?')) return;
    
    try {
      console.log('🗑️ Deleting chat:', chatIdToDelete);
      
      // Delete all messages in the chat
      const messagesQuery = query(collection(db, `chats/${chatIdToDelete}/messages`));
      const messagesSnapshot = await getDocs(messagesQuery);
      const deletePromises = messagesSnapshot.docs.map(msgDoc => 
        deleteDoc(doc(db, `chats/${chatIdToDelete}/messages`, msgDoc.id))
      );
      await Promise.all(deletePromises);
      
      // Delete the chat document
      await deleteDoc(doc(db, 'chats', chatIdToDelete));
      
      // Update UI
      setChats(prev => prev.filter(c => c.id !== chatIdToDelete));
      
      if (chatId === chatIdToDelete) {
        // Reset to empty state instead of creating new chat
        setMessages([]);
        setChatId(null);
        setInput('');
        setSelectedAgent(null);
        setCurrentChatVisibility('private');
      }
      
      console.log('✅ Chat deleted');
      alert('Conversa excluída com sucesso!');
    } catch (error) {
      console.error('❌ Error deleting chat:', error);
      alert('Erro ao excluir conversa');
    }
  };

  const startEditingTitle = (chat: Chat) => {
    if (!user) return;
    
    // Only allow owner to edit title
    if (chat.ownerId !== user.id) {
      alert('Apenas o criador pode editar o título desta conversa.');
      return;
    }
    
    setEditingChatId(chat.id);
    setEditingTitle(chat.title);
  };

  const saveTitle = async (chatIdToUpdate: string) => {
    if (!user || !editingTitle.trim()) return;
    
    // Verify ownership before updating
    const chatToUpdate = chats.find(c => c.id === chatIdToUpdate);
    if (!chatToUpdate || chatToUpdate.ownerId !== user.id) {
      alert('Apenas o criador pode editar esta conversa.');
      return;
    }
    
    try {
      console.log('✏️ Updating chat title:', chatIdToUpdate);
      
      await updateDoc(doc(db, 'chats', chatIdToUpdate), {
        title: editingTitle.trim(),
        updatedAt: serverTimestamp(),
      });
      
      // Update local state
      setChats(prev => prev.map(c => 
        c.id === chatIdToUpdate ? { ...c, title: editingTitle.trim() } : c
      ));
      
      setEditingChatId(null);
      setEditingTitle('');
      
      console.log('✅ Title updated');
    } catch (error) {
      console.error('❌ Error updating title:', error);
      alert('Erro ao atualizar título');
    }
  };

  const cancelEditing = () => {
    setEditingChatId(null);
    setEditingTitle('');
  };

  // Filter chats based on search and visibility
  const filteredChats = chats.filter(chat => {
    // Filter by search term
    const matchesSearch = chat.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          chat.lastMessage.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by visibility
    const matchesVisibility = visibilityFilter === 'all' ||
                               (visibilityFilter === 'private' && chat.visibility === 'private') ||
                               (visibilityFilter === 'sector' && chat.visibility === 'sector');
    
    return matchesSearch && matchesVisibility;
  });

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  // Redirect se não estiver autenticado
  useEffect(() => {
    console.log('🔍 Checking auth status - Loading:', authLoading, 'User:', user);
    if (!authLoading && !user) {
      console.log('🚪 Redirecting to login...');
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center mb-4 mx-auto">
            <Sparkles className="w-8 h-8 text-white animate-pulse" />
          </div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return null; // Redirect will happen in useEffect
  }

  const sendMessage = async () => {
    if (!input.trim() || loading || !user) return;

    console.log('🚀 Enviando mensagem:', input.trim());

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      let currentChatId = chatId;
      if (!currentChatId) {
        console.log('📝 Criando novo chat...');
        const chatDoc = await addDoc(collection(db, 'chats'), {
          title: input.trim().substring(0, 50),
          visibility: currentChatVisibility,
          ownerId: user.id,
          ownerName: user.name,
          agentId: selectedAgent?.id || null,
          agentName: selectedAgent?.name || null,
          promptId: appliedPrompt?.id || null,
          promptTitle: appliedPrompt?.title || null,
          promptContent: appliedPrompt?.content || null,
          sectorId: currentChatVisibility === 'sector' ? user.sectorId : null,
          allowedUsers: currentChatVisibility === 'sector' ? [] : [user.id],
          lastMessage: input.trim(),
          lastMessageAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        currentChatId = chatDoc.id;
        setChatId(currentChatId);
        console.log('✅ Chat criado:', currentChatId, 'com agente:', selectedAgent?.name || 'nenhum', 'e prompt:', appliedPrompt?.title || 'nenhum');

        await addDoc(collection(db, `chats/${currentChatId}/messages`), {
          chatId: currentChatId,
          role: 'user',
          content: input.trim(),
          userId: user.id,
          userName: user.name,
          timestamp: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, `chats/${currentChatId}/messages`), {
          chatId: currentChatId,
          role: 'user',
          content: input.trim(),
          userId: user.id,
          userName: user.name,
          timestamp: serverTimestamp(),
        });
      }

      console.log('🤖 Chamando API de chat...');
      
      // Construir mensagens para API
      const apiMessages = [...messages, userMessage];
      
      // Definir o system prompt a ser usado (permanece durante toda a conversa)
      let systemPromptToUse = selectedAgent?.systemPrompt;
      if (appliedPrompt) {
        // Se há um prompt aplicado, ele tem prioridade e persiste durante toda a conversa
        systemPromptToUse = appliedPrompt.content;
        console.log('📋 Usando prompt permanente:', appliedPrompt.title);
      }
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          systemPrompt: systemPromptToUse || undefined,
        }),
      });

      console.log('📡 Resposta recebida:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Erro na resposta:', errorData);
        throw new Error(errorData.error || 'Failed to get response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      if (reader) {
        console.log('📖 Lendo stream...');
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log('✅ Stream concluído');
            break;
          }

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  assistantMessage += parsed.content;
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = assistantMessage;
                    return newMessages;
                  });
                }
              } catch (e) {
                console.warn('⚠️ Erro ao parsear linha:', e);
              }
            }
          }
        }
      }

      if (currentChatId && assistantMessage) {
        console.log('💾 Salvando resposta no Firestore...');
        await addDoc(collection(db, `chats/${currentChatId}/messages`), {
          chatId: currentChatId,
          role: 'assistant',
          content: assistantMessage,
          userId: 'assistant',
          timestamp: serverTimestamp(),
        });
        
        // Update chat's last message
        await updateDoc(doc(db, 'chats', currentChatId), {
          lastMessage: assistantMessage.substring(0, 100),
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        
        // Reload chats to update sidebar
        loadChats();
        
        console.log('✅ Resposta salva');
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      setMessages((prev) => [
        ...prev,
        { 
          role: 'assistant', 
          content: `Desculpe, ocorreu um erro ao processar sua mensagem.\n\nDetalhes: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
        },
      ]);
    } finally {
      setLoading(false);
      console.log('🏁 Processo concluído');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      console.log('⌨️ Enter pressionado, enviando mensagem...');
      sendMessage();
    }
  };

  const handleSendClick = () => {
    console.log('🖱️ Botão de enviar clicado');
    console.log('📝 Input atual:', input);
    console.log('⏳ Loading:', loading);
    console.log('👤 User:', user ? 'Existe' : 'Null');
    sendMessage();
  };

  const suggestions = [
    { icon: Sparkles, text: 'Explique o conceito de IA generativa', color: 'from-purple-500 to-purple-600' },
    { icon: Zap, text: 'Como posso melhorar minha produtividade?', color: 'from-pink-500 to-pink-600' },
    { icon: Bot, text: 'Crie um plano de estudos personalizado', color: 'from-blue-500 to-blue-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 flex">
      {/* Sidebar - Histórico de Conversas */}
      <div className={`${showSidebar ? 'w-80' : 'w-0'} transition-all duration-300 bg-white border-r border-gray-200 flex flex-col overflow-hidden`}>
        <div className="p-4 border-b border-gray-200 space-y-3">
          <button
            onClick={createNewChat}
            className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nova Conversa
          </button>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar conversas..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Visibility Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setVisibilityFilter('all')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                visibilityFilter === 'all'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setVisibilityFilter('private')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                visibilityFilter === 'private'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Lock className="w-3 h-3" />
              Pessoais
            </button>
            <button
              onClick={() => setVisibilityFilter('sector')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                visibilityFilter === 'sector'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Users className="w-3 h-3" />
              Setor
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loadingChats ? (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="mt-2 text-sm">Carregando...</p>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">
                {searchTerm || visibilityFilter !== 'all' 
                  ? 'Nenhuma conversa encontrada'
                  : 'Nenhuma conversa ainda'}
              </p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <div
                key={chat.id}
                className={`group p-3 rounded-xl transition-all overflow-hidden ${
                  chatId === chat.id
                    ? 'bg-orange-50 border-2 border-orange-500'
                    : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                }`}
              >
                {editingChatId === chat.id ? (
                  // Edit Mode
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') saveTitle(chat.id);
                        if (e.key === 'Escape') cancelEditing();
                      }}
                      className="w-full px-3 py-2 border border-orange-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveTitle(chat.id)}
                        className="flex-1 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        Salvar
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-300 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="flex items-start gap-2 min-w-0">
                    <div onClick={() => loadChatMessages(chat.id)} className="flex-1 cursor-pointer min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 text-sm truncate flex-1 min-w-0">
                          {chat.title}
                        </h3>
                        {chat.visibility === 'sector' ? (
                          <div title="Conversa do setor">
                            <Users className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          </div>
                        ) : (
                          <div title="Conversa pessoal">
                            <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 truncate">
                        {chat.lastMessage}
                      </p>
                      <div className="flex items-center gap-2 mt-1 overflow-hidden min-w-0">
                        <p className="text-xs text-gray-400 flex-shrink-0">
                          {chat.lastMessageAt?.toDate?.()?.toLocaleDateString() || 'Agora'}
                        </p>
                        {chat.visibility === 'sector' && chat.ownerName && (
                          <>
                            <span className="text-xs text-gray-400 flex-shrink-0">•</span>
                            <p className={`text-xs font-medium truncate min-w-0 ${
                              chat.ownerId === user?.id ? 'text-orange-600' : 'text-blue-600'
                            }`}>
                              {chat.ownerId === user?.id ? 'Você' : chat.ownerName}
                            </p>
                          </>
                        )}
                        {chat.agentName && (
                          <>
                            <span className="text-xs text-gray-400 flex-shrink-0">•</span>
                            <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                              <Bot className="w-3 h-3 text-purple-500 flex-shrink-0" />
                              <p className="text-xs font-medium text-purple-600 truncate">
                                {chat.agentName}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Show edit/delete buttons only for chat owner */}
                    {user && chat.ownerId === user.id && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingTitle(chat);
                          }}
                          className="p-2 hover:bg-blue-50 rounded-lg"
                          title="Renomear conversa"
                        >
                          <Edit2 className="w-4 h-4 text-blue-500" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteChat(chat.id);
                          }}
                          className="p-2 hover:bg-red-50 rounded-lg"
                          title="Excluir conversa"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
                >
                  {showSidebar ? <X className="w-5 h-5 text-gray-600" /> : <Menu className="w-5 h-5 text-gray-600" />}
                </button>
                <Link
                  href="/dashboard"
                  className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </Link>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900">
                      {chatId ? 'Conversa' : 'Nova Conversa'}
                    </h1>
                    <p className="text-gray-600 text-sm">
                      {selectedAgent ? `Agente: ${selectedAgent.name}` : 'Chat com IA inteligente'}
                      {appliedPrompt && !selectedAgent && ' • Prompt ativo'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {appliedPrompt && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg border border-purple-200">
                      <FileText className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-700">{appliedPrompt.title}</span>
                    </div>
                  )}
                  {selectedAgent && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                      <Bot className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700">{selectedAgent.name}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>Online</span>
                </div>
                <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-green-500 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 max-w-4xl mx-auto">
              <div className="text-center space-y-8 fade-in w-full">
                <div className="flex items-center justify-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-orange-500 via-orange-600 to-red-500 rounded-3xl flex items-center justify-center shadow-2xl pulse-subtle">
                    <Sparkles className="w-12 h-12 text-white" />
                  </div>
                </div>

                <div>
                  <h2 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-3">
                    Como posso ajudar?
                  </h2>
                  <p className="text-gray-600 text-lg">
                    Faça uma pergunta ou escolha uma sugestão abaixo
                  </p>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <MessageSquare className="w-8 h-8 text-orange-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-2xl font-bold text-gray-900 truncate">IA Avançada</div>
                        <div className="text-gray-600 text-sm truncate">Tecnologia GPT-4</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <Zap className="w-8 h-8 text-orange-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-2xl font-bold text-gray-900 truncate">Respostas</div>
                        <div className="text-gray-600 text-sm truncate">Rápidas e precisas</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <Bot className="w-8 h-8 text-orange-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-2xl font-bold text-gray-900 truncate">Contextual</div>
                        <div className="text-gray-600 text-sm truncate">Aprende com você</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mt-8 w-full max-w-4xl">
                  {suggestions.map((suggestion, i) => {
                    const Icon = suggestion.icon;
                    return (
                      <button
                        key={i}
                        onClick={() => setInput(suggestion.text)}
                        className="group p-6 bg-white hover:bg-orange-50 rounded-2xl border border-gray-200 hover:border-orange-300 transition-all duration-300 text-left shadow-lg hover:shadow-xl"
                        style={{ animationDelay: `${i * 0.1}s` }}
                      >
                        <div className={`w-12 h-12 bg-gradient-to-br ${suggestion.color} rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform flex-shrink-0`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <p className="text-sm font-medium text-gray-700 leading-relaxed line-clamp-3">
                          {suggestion.text}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-4 fade-in ${
                    message.role === 'assistant'
                      ? 'bg-white -mx-6 px-6 py-6 rounded-2xl border-l-4 border-orange-500 shadow-sm'
                      : ''
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                      message.role === 'user'
                        ? 'bg-gradient-to-br from-orange-500 to-orange-600'
                        : 'bg-gradient-to-br from-orange-500 to-red-500'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <UserIcon className="w-6 h-6 text-white" />
                    ) : (
                      <Bot className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="whitespace-pre-wrap text-gray-900 leading-relaxed text-[15px]">
                      {message.content || (
                        <span className="inline-flex items-center gap-2 text-orange-400">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                          <span className="text-orange-600 font-medium">Pensando...</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white p-6 shadow-lg">
          <div className="max-w-4xl mx-auto">
            <div className="relative flex items-end gap-3 bg-gray-50 rounded-3xl p-4 shadow-sm border-2 border-gray-200 focus-within:border-orange-500 transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Envie uma mensagem..."
                rows={1}
                className="flex-1 bg-transparent px-2 py-2 outline-none resize-none max-h-32 text-gray-900 placeholder:text-gray-400"
                disabled={loading}
                style={{ minHeight: '24px', maxHeight: '200px' }}
              />
              <button
                onClick={handleSendClick}
                disabled={loading || !input.trim()}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                  input.trim() && !loading
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:shadow-xl'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                <Send className={`w-5 h-5 ${input.trim() && !loading ? 'text-white' : 'text-gray-500'}`} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Pressione <kbd className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold">Enter</kbd> para enviar • <kbd className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold">Shift + Enter</kbd> para nova linha
            </p>
          </div>
        </div>
      </div>

      {/* Modal de Seleção de Agente */}
      {showAgentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Selecionar Agente</h2>
                  <p className="text-gray-600 mt-1">Escolha um agente para esta conversa ou continue sem agente</p>
                </div>
                <button
                  onClick={() => setShowAgentModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Mostrar prompt aplicado */}
              {appliedPrompt && (
                <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-purple-900">Prompt Aplicado:</h4>
                        <span className="px-2 py-0.5 bg-purple-200 text-purple-700 text-xs rounded-full font-medium">
                          Persistente
                        </span>
                      </div>
                      <p className="text-sm text-purple-700 font-medium">{appliedPrompt.title}</p>
                      <p className="text-xs text-purple-600 mt-1">
                        Este prompt permanecerá ativo durante toda a conversa
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setAppliedPrompt(null);
                        console.log('🗑️ Prompt removido');
                      }}
                      className="flex-shrink-0 p-2 hover:bg-purple-100 rounded-lg transition-colors text-purple-600 hover:text-purple-800"
                      title="Remover prompt"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {/* Opção sem agente */}
              <button
                onClick={() => {
                  setShowAgentModal(false);
                  setShowVisibilityModal(true);
                  setSelectedAgent(null);
                }}
                className="w-full p-4 border-2 border-gray-200 hover:border-orange-500 rounded-xl transition-all group text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-100 group-hover:bg-orange-100 rounded-xl flex items-center justify-center transition-colors">
                    <MessageSquare className="w-6 h-6 text-gray-400 group-hover:text-orange-600 transition-colors" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Sem Agente</h3>
                    <p className="text-sm text-gray-600">Conversa padrão sem personalização</p>
                  </div>
                </div>
              </button>

              {/* Lista de agentes */}
              {agents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Bot className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Nenhum agente disponível</p>
                  <p className="text-sm mt-1">Crie agentes na página de Agentes</p>
                </div>
              ) : (
                agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      setSelectedAgent(agent);
                      setShowAgentModal(false);
                      setShowVisibilityModal(true);
                    }}
                    className="w-full p-4 border-2 border-gray-200 hover:border-blue-500 rounded-xl transition-all group text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 group-hover:bg-blue-500 rounded-xl flex items-center justify-center transition-colors">
                        <Bot className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                        {agent.description && (
                          <p className="text-sm text-gray-600 truncate">{agent.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {agent.visibility === 'sector' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">
                              <Users className="w-3 h-3" />
                              Setor
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                              <Lock className="w-3 h-3" />
                              Pessoal
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowAgentModal(false)}
                className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Seleção de Visibilidade */}
      {showVisibilityModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Nova Conversa</h2>
              <p className="text-gray-600">Escolha a visibilidade da conversa</p>
            </div>
            
            {/* Mostrar prompt aplicado no modal de visibilidade também */}
            {appliedPrompt && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-purple-900">Prompt:</p>
                    <p className="text-sm text-purple-700 font-semibold">{appliedPrompt.title}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => startNewChatWithAgent(selectedAgent, 'private')}
                className="w-full p-4 border-2 border-gray-200 hover:border-orange-500 rounded-xl transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 group-hover:bg-orange-500 rounded-xl flex items-center justify-center transition-colors">
                    <Lock className="w-6 h-6 text-orange-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="font-semibold text-gray-900">Pessoal</h3>
                    <p className="text-sm text-gray-600">Apenas você terá acesso</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => startNewChatWithAgent(selectedAgent, 'sector')}
                disabled={!user?.sectorId}
                className={`w-full p-4 border-2 rounded-xl transition-all group ${
                  user?.sectorId
                    ? 'border-gray-200 hover:border-blue-500'
                    : 'border-gray-200 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                    user?.sectorId
                      ? 'bg-blue-100 group-hover:bg-blue-500'
                      : 'bg-gray-100'
                  }`}>
                    <Users className={`w-6 h-6 transition-colors ${
                      user?.sectorId
                        ? 'text-blue-600 group-hover:text-white'
                        : 'text-gray-400'
                    }`} />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="font-semibold text-gray-900">Setor</h3>
                    <p className="text-sm text-gray-600">
                      {user?.sectorId ? 'Todo o setor terá acesso' : 'Você não está em um setor'}
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {selectedAgent && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Bot className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">Agente Selecionado</p>
                    <p className="text-sm text-blue-700 mt-1">{selectedAgent.name}</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setShowVisibilityModal(false);
                setShowAgentModal(true);
              }}
              className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
