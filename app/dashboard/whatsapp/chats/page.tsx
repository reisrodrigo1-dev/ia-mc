'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { 
  collection, 
  addDoc,
  getDocs, 
  updateDoc,
  doc, 
  query, 
  where,
  orderBy,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { WhatsAppConnection, WhatsAppChat, WhatsAppMessage } from '@/types';
import { 
  MessageCircle,
  Send,
  Phone,
  Clock,
  Tag,
  StickyNote,
  Power,
  User,
  Loader2,
  X,
  Bot,
  UserCircle,
  Plus,
  Trash2,
  Edit2,
  RotateCcw
} from 'lucide-react';

import { getTrainingData } from '@/lib/whatsapp/training';

export default function WhatsAppChatsPage() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [creatingChat, setCreatingChat] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<string>('checking');
  const [isRestoring, setIsRestoring] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeTraining, setActiveTraining] = useState<any>(null);

  useEffect(() => {
    loadConnections();
  }, [user]);

  useEffect(() => {
    if (selectedConnectionId) {
      loadChats();
      // Tentar restaurar a conexão automaticamente se necessário
      checkAndRestoreConnection();
    }
  }, [selectedConnectionId]);

  const checkAndRestoreConnection = async () => {
    if (!selectedConnectionId) return;

    setConnectionStatus('checking');
    try {
      // Verificar status da conexão
      const statusResponse = await fetch(`/api/whatsapp/connect?connectionId=${selectedConnectionId}`);
      const statusData = await statusResponse.json();

      console.log('🔍 Status da conexão:', statusData);

      setConnectionStatus(statusData.status || 'unknown');

      // Se não estiver conectado, tentar restaurar automaticamente
      if (!statusData.connected && statusData.status !== 'connected' && !statusData.qrCode) {
        console.log('🔄 Tentando restaurar conexão automaticamente...');
        
        const restoreResponse = await fetch('/api/whatsapp/connect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            connectionId: selectedConnectionId,
          }),
        });

        if (restoreResponse.ok) {
          console.log('✅ Conexão restaurada automaticamente');
          setConnectionStatus('connecting');
        } else {
          console.warn('⚠️ Não foi possível restaurar a conexão automaticamente');
        }
      }
    } catch (error) {
      console.error('Erro ao verificar/restaurar conexão:', error);
      setConnectionStatus('error');
    }
  };

  useEffect(() => {
    if (selectedChat) {
      loadMessages();
      const fetchTraining = async () => {
        try {
          const training = await getTrainingData(selectedChat.connectionId);
          setActiveTraining(training);
        } catch (error) {
          console.error('Erro ao carregar treinamento:', error);
        }
      };
      fetchTraining();
    }
  }, [selectedChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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

  const loadChats = async () => {
    if (!selectedConnectionId) return;

    try {
      const chatsRef = collection(db, 'whatsapp_chats');
      const q = query(
        chatsRef,
        where('connectionId', '==', selectedConnectionId),
        orderBy('lastMessageAt', 'desc')
      );

      // Real-time listener
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loadedChats = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter((chat: any) => !chat.deleted) as WhatsAppChat[]; // Filtrar chats deletados

        setChats(loadedChats);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Erro ao carregar chats:', error);
    }
  };

  const loadMessages = async () => {
    if (!selectedChat) return;

    try {
      const messagesRef = collection(db, 'whatsapp_messages');
      const q = query(
        messagesRef,
        where('chatId', '==', selectedChat.id),
        orderBy('timestamp', 'asc')
      );

      // Real-time listener
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loadedMessages = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter((msg: any) => !msg.deleted) as WhatsAppMessage[]; // Filtrar mensagens deletadas

        setMessages(loadedMessages);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedChat || !user) return;

    console.log('🚀 Tentando enviar mensagem:', {
      connectionId: selectedChat.connectionId,
      phoneNumber: selectedChat.contactNumber,
      message: messageInput,
      selectedChat
    });

    try {
      // Primeiro tentar enviar normalmente
      let response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionId: selectedChat.connectionId,
          phoneNumber: selectedChat.contactNumber,
          message: messageInput,
        }),
      });

      console.log('📡 Resposta do servidor:', response.status);

      // Se não estiver conectado, tentar restaurar automaticamente
      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Erro do servidor:', error);
        console.error('❌ Mensagem de erro:', error.error);
        console.error('❌ Detalhes:', error.details);
        
        // Se for erro de conexão fechada ou não encontrada, tentar restaurar
        if (error.details?.includes('Connection Closed') || 
            error.error?.includes('não encontrada') || 
            error.error?.includes('não está ativa') || 
            error.error?.includes('Status:')) {
          console.log('🔄 Tentando restaurar conexão automaticamente...');
          setIsRestoring(true);
          
          try {
            // Tentar restaurar sessão automaticamente
            const restoreResponse = await fetch('/api/whatsapp/connect', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                connectionId: selectedChat.connectionId,
              }),
            });

            if (restoreResponse.ok) {
              console.log('✅ Conexão restaurada! Aguardando 10 segundos para estabilizar...');
              
              // Aguardar 10 segundos para a conexão estabelecer e estabilizar
              await new Promise(resolve => setTimeout(resolve, 10000));
              
              // Verificar se realmente conectou (verificar múltiplas vezes)
              let connected = false;
              for (let i = 0; i < 3; i++) {
                const checkResponse = await fetch(`/api/whatsapp/connect?connectionId=${selectedChat.connectionId}`);
                const checkData = await checkResponse.json();
                
                console.log(`Verificação ${i + 1}/3:`, checkData.status);
                
                if (checkData.status === 'connected') {
                  connected = true;
                  break;
                }
                
                // Aguardar mais 2 segundos entre verificações
                if (i < 2) await new Promise(resolve => setTimeout(resolve, 2000));
              }
              
              if (!connected) {
                throw new Error('Conexão não foi estabelecida após múltiplas tentativas. Aguarde mais alguns segundos e tente novamente.');
              }            // Tentar enviar novamente
            console.log('🔄 Tentando enviar novamente após restauração...');
            response = await fetch('/api/whatsapp/send', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                connectionId: selectedChat.connectionId,
                phoneNumber: selectedChat.contactNumber,
                message: messageInput,
              }),
            });

              if (!response.ok) {
                const retryError = await response.json();
                throw new Error('Conexão restaurada mas ainda não conseguiu enviar. A conexão pode estar instável. Tente novamente.');
              }
            } else {
              throw new Error('Não foi possível restaurar a conexão. Vá em Conexões e clique em "Verificar Status".');
            }
          } catch (restoreError: any) {
            console.error('Erro ao restaurar:', restoreError);
            throw new Error(restoreError.message || 'Erro ao restaurar conexão');
          } finally {
            setIsRestoring(false);
          }
        } else {
          throw new Error(error.error || 'Erro ao enviar mensagem');
        }
      }      console.log('✅ Mensagem enviada via API, salvando no Firestore...');

      // Salvar mensagem no Firestore
      const newMessage: Omit<WhatsAppMessage, 'id'> = {
        connectionId: selectedChat.connectionId,
        chatId: selectedChat.id,
        from: 'me',
        to: selectedChat.contactNumber,
        message: messageInput,
        isFromMe: true,
        timestamp: Timestamp.now(),
        status: 'sent',
      };

      await addDoc(collection(db, 'whatsapp_messages'), newMessage);
      
      // Update chat last message
      await updateDoc(doc(db, 'whatsapp_chats', selectedChat.id), {
        lastMessage: messageInput,
        lastMessageAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      console.log('✅ Mensagem salva no Firestore');
      setMessageInput('');
    } catch (error: any) {
      console.error('❌ Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem: ' + error.message);
    }
  };

  const toggleAI = async (chatId: string, currentState: boolean) => {
    try {
      await updateDoc(doc(db, 'whatsapp_chats', chatId), {
        isAiActive: !currentState,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Erro ao alternar IA:', error);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conversa? Todas as mensagens serão perdidas.')) {
      return;
    }

    try {
      // Excluir todas as mensagens do chat
      const messagesRef = collection(db, 'whatsapp_messages');
      const messagesQuery = query(messagesRef, where('chatId', '==', chatId));
      const messagesSnapshot = await getDocs(messagesQuery);
      
      const deletePromises = messagesSnapshot.docs.map(doc => 
        updateDoc(doc.ref, { deleted: true }) // Soft delete
      );
      
      await Promise.all(deletePromises);

      // Excluir o chat (soft delete)
      await updateDoc(doc(db, 'whatsapp_chats', chatId), {
        deleted: true,
        deletedAt: Timestamp.now(),
      });

      // Se o chat excluído estava selecionado, limpar seleção
      if (selectedChat?.id === chatId) {
        setSelectedChat(null);
        setMessages([]);
      }

      alert('Conversa excluída com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir conversa:', error);
      alert('Erro ao excluir conversa');
    }
  };

  const handleResetTraining = async () => {
    if (!selectedChat || !selectedConnectionId) return;

    if (!confirm('Deseja resetar o treinamento desta conversa? O cliente precisará usar uma palavra-chave novamente para iniciar um novo treinamento.')) {
      return;
    }

    try {
      const response = await fetch('/api/whatsapp/reset-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedConnectionId,
          phoneNumber: selectedChat.contactNumber
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao resetar treinamento');
      }

      setActiveTraining(null);
      alert('Treinamento resetado com sucesso!');
    } catch (error) {
      console.error('Erro ao resetar treinamento:', error);
      alert('Erro ao resetar treinamento');
    }
  };

  const handleStartEditName = (chat: WhatsAppChat) => {
    setEditingChatId(chat.id);
    setEditingName(chat.contactName || chat.contactNumber);
  };

  const handleSaveEditName = async (chatId: string) => {
    if (!editingName.trim()) {
      alert('Nome não pode estar vazio');
      return;
    }

    try {
      await updateDoc(doc(db, 'whatsapp_chats', chatId), {
        contactName: editingName.trim(),
        updatedAt: Timestamp.now(),
      });

      setEditingChatId(null);
      setEditingName('');
    } catch (error) {
      console.error('Erro ao editar nome:', error);
      alert('Erro ao editar nome');
    }
  };

  const handleCancelEditName = () => {
    setEditingChatId(null);
    setEditingName('');
  };

  const handleCreateNewChat = async () => {
    if (!newChatPhone.trim() || !selectedConnectionId || !user) {
      alert('Preencha o número do WhatsApp');
      return;
    }

    // Remover caracteres não numéricos
    const cleanPhone = newChatPhone.replace(/\D/g, '');
    
    if (cleanPhone.length < 10) {
      alert('Número inválido. Use o formato: (11) 99999-9999 ou 5511999999999');
      return;
    }

    // Adicionar código do país se não tiver
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    setCreatingChat(true);
    try {
      // Verificar se já existe um chat com esse número
      const chatsRef = collection(db, 'whatsapp_chats');
      const existingQuery = query(
        chatsRef,
        where('connectionId', '==', selectedConnectionId),
        where('contactNumber', '==', fullPhone)
      );
      
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        // Se já existe, apenas selecionar
        const existingChat = {
          id: existingSnapshot.docs[0].id,
          ...existingSnapshot.docs[0].data()
        } as WhatsAppChat;
        setSelectedChat(existingChat);
        setShowNewChatModal(false);
        setNewChatPhone('');
        setNewChatName('');
        alert('Conversa já existe! Selecionada para você.');
        return;
      }

      // Criar novo chat
      const newChat: Omit<WhatsAppChat, 'id'> = {
        connectionId: selectedConnectionId,
        contactNumber: fullPhone,
        contactName: newChatName.trim() || fullPhone,
        lastMessage: '',
        lastMessageAt: Timestamp.now(),
        status: 'active',
        isAiActive: false,
        tags: [],
        notes: '',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, 'whatsapp_chats'), newChat);
      
      // Selecionar o novo chat
      setSelectedChat({
        id: docRef.id,
        ...newChat
      } as WhatsAppChat);

      setShowNewChatModal(false);
      setNewChatPhone('');
      setNewChatName('');
      alert('✅ Conversa criada! Envie uma mensagem para iniciar.');
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
      alert('Erro ao criar conversa');
    } finally {
      setCreatingChat(false);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
          <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma conexão ativa</h3>
          <p className="text-gray-600">Conecte um WhatsApp primeiro para visualizar conversas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Conversas WhatsApp</h1>
            <p className="text-gray-600 text-sm mt-1">Monitore e participe das conversas em tempo real</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowNewChatModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nova Conversa
            </button>
            
            <select
              value={selectedConnectionId}
              onChange={(e) => setSelectedConnectionId(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              {connections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name} ({conn.status || 'desconhecido'})
                </option>
              ))}
            </select>
            
            <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
              connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
              connectionStatus === 'disconnected' ? 'bg-red-100 text-red-800' :
              connectionStatus === 'qr-code' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {connectionStatus === 'connected' ? 'Conectado' :
               connectionStatus === 'connecting' ? 'Conectando' :
               connectionStatus === 'disconnected' ? 'Desconectado' :
               connectionStatus === 'qr-code' ? 'Aguardando QR' :
               connectionStatus === 'checking' ? 'Verificando' :
               'Desconhecido'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Chats List */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Conversas ({chats.length})</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {chats.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 text-sm">Nenhuma conversa ainda</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {chats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedChat?.id === chat.id ? 'bg-orange-50 border-l-4 border-orange-600' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {chat.contactName || chat.contactNumber}
                          </h3>
                          <p className="text-xs text-gray-500">{chat.contactNumber}</p>
                        </div>
                      </div>
                      {chat.isAiActive && (
                        <div className="p-1 bg-green-100 rounded-full">
                          <Bot className="w-4 h-4 text-green-600" />
                        </div>
                      )}
                    </div>
                    
                    {chat.lastMessage && (
                      <p className="text-sm text-gray-600 truncate mb-1">{chat.lastMessage}</p>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        chat.status === 'active' 
                          ? 'bg-green-100 text-green-700'
                          : chat.status === 'waiting'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {chat.status === 'active' ? 'Ativa' : chat.status === 'waiting' ? 'Aguardando' : 'Fechada'}
                      </span>
                      {chat.lastMessageAt && (
                        <span className="text-xs text-gray-500">
                          {formatTime(chat.lastMessageAt)}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        {selectedChat ? (
          <div className="flex-1 flex flex-col bg-gray-50">
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    {editingChatId === selectedChat.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="Nome do contato"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEditName(selectedChat.id)}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={handleCancelEditName}
                          className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">
                          {selectedChat.contactName || selectedChat.contactNumber}
                        </h3>
                        <button
                          onClick={() => handleStartEditName(selectedChat)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Editar nome"
                        >
                          <Edit2 className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    )}
                    <p className="text-sm text-gray-500">{selectedChat.contactNumber}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-500">
                        Treinamento: {activeTraining?.name || 'Nenhum'}
                      </p>
                      {activeTraining && (
                        <button
                          onClick={handleResetTraining}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Resetar treinamento desta conversa"
                        >
                          <RotateCcw className="w-3 h-3 text-gray-600" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAI(selectedChat.id, selectedChat.isAiActive)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      selectedChat.isAiActive
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    title={selectedChat.isAiActive ? 'Desligar IA' : 'Ligar IA'}
                  >
                    <Bot className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {selectedChat.isAiActive ? 'IA Ligada' : 'Ligar IA'}
                    </span>
                  </button>
                  <button
                    onClick={() => handleDeleteChat(selectedChat.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir conversa"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isFromMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-md px-4 py-2 rounded-lg ${
                      message.isFromMe
                        ? 'bg-orange-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-900'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className={`text-xs ${
                        message.isFromMe ? 'text-orange-100' : 'text-gray-500'
                      }`}>
                        {formatTime(message.timestamp)}
                      </p>
                      {message.isFromMe && message.aiTrainingName && (
                        <span className="text-xs bg-orange-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Bot className="w-3 h-3" />
                          {message.aiTrainingName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              {isRestoring && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  <span className="text-sm text-blue-700">Restaurando conexão WhatsApp... Aguarde.</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || isRestoring}
                  className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Selecione uma conversa para começar</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal Nova Conversa */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Nova Conversa</h2>
              <button
                onClick={() => {
                  setShowNewChatModal(false);
                  setNewChatPhone('');
                  setNewChatName('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número do WhatsApp *
                </label>
                <input
                  type="text"
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  placeholder="(11) 99999-9999 ou 5511999999999"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Digite com ou sem código do país (55)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Contato (opcional)
                </label>
                <input
                  type="text"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowNewChatModal(false);
                    setNewChatPhone('');
                    setNewChatName('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateNewChat}
                  disabled={creatingChat || !newChatPhone.trim()}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creatingChat ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar Conversa'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
