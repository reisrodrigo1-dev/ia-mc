'use client';

import { useState, useEffect } from 'react';
import { Bot, Plus, Sparkles, Users, MessageSquare, Zap, Settings, X, FileText, Building2, ChevronRight, ArrowLeft, Search, Lock, Edit2, Trash2, User as UserIcon } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';

type CreationStep = 'method' | 'structured' | 'framework';

interface Agent {
  id: string;
  name: string;
  description?: string;
  method: 'structured' | 'framework';
  visibility: 'private' | 'sector';
  ownerId: string;
  ownerName?: string;
  sectorId?: string | null;
  systemPrompt: string;
  createdAt: any;
}

export default function AgentsPage() {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creationStep, setCreationStep] = useState<CreationStep>('method');
  const [selectedMethod, setSelectedMethod] = useState<'structured' | 'framework' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [visibility, setVisibility] = useState<'private' | 'sector'>('private');
  const [searchTerm, setSearchTerm] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'private' | 'sector'>('all');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Método Estruturado
  const [structuredData, setStructuredData] = useState({
    name: '',
    role: '',
    personality: '',
    expertise: '',
    task: '',
    audience: '',
    language: '',
    constraints: {
      never: '',
      always: '',
      limits: ''
    },
    outputFormat: {
      start: '',
      formatting: ''
    }
  });

  // Método Framework (FGAC)
  const [frameworkData, setFrameworkData] = useState({
    version: '1.0',
    identity: {
      name: '',
      title: '',
      company: '',
      personality: '',
      quality: ''
    },
    task: {
      responsibility: '',
      department: '',
      successMetric: ''
    },
    audience: {
      userType: '',
      knowledgeLevel: 'básico'
    },
    governance: {
      tone: '',
      errorAction: '',
      prohibitions: '',
      requirements: '',
      sensitiveTopics: '',
      standardResponse: ''
    },
    output: {
      greeting: '',
      formatting: ''
    }
  });

  // Load agents on mount
  useEffect(() => {
    if (user) {
      loadAgents();
    }
  }, [user]);

  const loadAgents = async () => {
    if (!user) return;
    
    setLoadingAgents(true);
    try {
      console.log('👤 Current user:', user.id, 'Sector:', user.sectorId);
      
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
      
      console.log('📝 Own agents loaded:', allAgents.length);
      
      // If user has a sector, also load sector agents
      if (user.sectorId) {
        console.log('🏢 Loading sector agents for sector:', user.sectorId);
        
        const sectorAgentsQuery = query(
          collection(db, 'agents'),
          where('visibility', '==', 'sector'),
          where('sectorId', '==', user.sectorId),
          orderBy('createdAt', 'desc')
        );
        
        const sectorSnapshot = await getDocs(sectorAgentsQuery);
        console.log('🏢 Sector agents found:', sectorSnapshot.docs.length);
        
        const sectorAgents = sectorSnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Agent));
        
        // Add sector agents that aren't already in the list (avoid duplicates)
        for (const sectorAgent of sectorAgents) {
          if (!allAgents.find(a => a.id === sectorAgent.id)) {
            allAgents.push(sectorAgent);
          }
        }
      } else {
        console.log('⚠️ User has no sector ID');
      }
      
      // Fetch owner names for ALL sector agents
      const uniqueOwnerIds = [...new Set(
        allAgents
          .filter(agent => agent.visibility === 'sector')
          .map(agent => agent.ownerId)
      )];
      
      console.log('👥 Fetching names for owners:', uniqueOwnerIds);
      
      const ownerNames: Record<string, string> = {};
      
      for (const ownerId of uniqueOwnerIds) {
        try {
          const userDoc = await getDocs(query(collection(db, 'users'), where('id', '==', ownerId)));
          if (!userDoc.empty) {
            const userData = userDoc.docs[0].data();
            ownerNames[ownerId] = userData.name || 'Usuário';
            console.log('✅ Found name for', ownerId, ':', ownerNames[ownerId]);
          } else {
            console.warn('⚠️ No user document found for:', ownerId);
            ownerNames[ownerId] = 'Usuário';
          }
        } catch (err) {
          console.error('❌ Error fetching owner name for:', ownerId, err);
          ownerNames[ownerId] = 'Usuário';
        }
      }
      
      // Add owner names to ALL sector agents (including own agents)
      allAgents = allAgents.map(agent => ({
        ...agent,
        ownerName: agent.visibility === 'sector' ? ownerNames[agent.ownerId] : undefined
      }));
      
      // Sort by creation time
      allAgents.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      
      setAgents(allAgents);
      console.log('📚 Loaded', allAgents.length, 'agents');
    } catch (error) {
      console.error('❌ Error loading agents:', error);
    } finally {
      setLoadingAgents(false);
    }
  };

  const handleCreateAgent = async () => {
    if (!user) {
      alert('Você precisa estar autenticado para criar um agente');
      return;
    }

    const agentName = selectedMethod === 'structured' ? structuredData.name : frameworkData.identity.name;
    
    if (!agentName.trim()) {
      alert('Por favor, preencha o nome do agente');
      return;
    }

    setIsLoading(true);

    try {
      console.log('🤖 Criando agente no Firestore...');

      // Construir o system prompt baseado no método escolhido
      let systemPrompt = '';
      
      if (selectedMethod === 'structured') {
        systemPrompt = `# PERSONA: ${structuredData.name}

## 1. PAPEL/IDENTIDADE (ROLE)
Você é um ${structuredData.role} com uma personalidade ${structuredData.personality}.
Sua experiência é em ${structuredData.expertise}.

## 2. OBJETIVO/TAREFA (TASK)
Você deve ${structuredData.task}

## 3. PÚBLICO-ALVO (AUDIENCE)
As respostas devem ser adaptadas para um ${structuredData.audience}.
A linguagem deve ser ${structuredData.language}.

## 4. RESTRIÇÕES/REGRAS (CONSTRAINTS)
**NUNCA** ${structuredData.constraints.never}
**SEMPRE** ${structuredData.constraints.always}
Limitação: ${structuredData.constraints.limits}

## 5. FORMATO DE SAÍDA (OUTPUT FORMAT)
Toda resposta deve começar com ${structuredData.outputFormat.start}.
Use ${structuredData.outputFormat.formatting} para destacar os pontos-chave.`;
      } else {
        systemPrompt = `# FRAMEWORK DE AGENTE CORPORATIVO: V_${frameworkData.version}

## A. IDENTIDADE E PROPÓSITO DO AGENTE

### A1. PAPEL/FUNÇÃO (ROLE)
Você é o ${frameworkData.identity.name}.
Seu título na empresa ${frameworkData.identity.company} é ${frameworkData.identity.title}.
Sua personalidade é ${frameworkData.identity.personality} e você é ${frameworkData.identity.quality}.

### A2. TAREFA ESPECÍFICA (TASK)
Sua principal responsabilidade é ${frameworkData.task.responsibility} para o departamento de ${frameworkData.task.department}.
Seu objetivo de sucesso é ${frameworkData.task.successMetric}.

### A3. PÚBLICO E NÍVEL DE CONHECIMENTO (AUDIENCE)
Você está se comunicando com ${frameworkData.audience.userType}.
O nível de conhecimento esperado do usuário é ${frameworkData.audience.knowledgeLevel}.

## B. GOVERNANÇA E REGRAS CORPORATIVAS

### B1. TOM DE VOZ CORPORATIVO
Aplica-se o Padrão de Comunicação Corporativa: ${frameworkData.governance.tone}.
Se houver erro, a resposta deve ser ${frameworkData.governance.errorAction}.

### B2. RESTRIÇÕES DE SEGURANÇA E CONFORMIDADE
**NUNCA** ${frameworkData.governance.prohibitions}
**SEMPRE** ${frameworkData.governance.requirements}
Se a pergunta for ${frameworkData.governance.sensitiveTopics}, você deve responder: "${frameworkData.governance.standardResponse}".

### B3. FORMATO DE SAÍDA
Comece sempre com ${frameworkData.output.greeting}.
Use ${frameworkData.output.formatting} para facilitar a leitura.`;
      }

      const agentData = {
        name: agentName,
        description: selectedMethod === 'structured' ? structuredData.task : frameworkData.task.responsibility,
        systemPrompt: systemPrompt,
        method: selectedMethod,
        methodData: selectedMethod === 'structured' ? structuredData : frameworkData,
        model: 'gpt-4',
        temperature: 0.7,
        visibility: visibility,
        ownerId: user.id,
        ownerName: user.name,
        sectorId: user.sectorId,
        allowedUsers: visibility === 'sector' ? [] : [user.id], // Se for setor, todos do setor têm acesso
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'agents'), agentData);
      
      console.log('✅ Agente criado com sucesso! ID:', docRef.id);
      alert(`Agente "${agentName}" criado com sucesso!`);
      
      // Reload agents list
      await loadAgents();
      
      resetModal();
    } catch (error) {
      console.error('❌ Erro ao criar agente:', error);
      alert(`Erro ao criar agente: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetModal = () => {
    setShowCreateModal(false);
    setCreationStep('method');
    setSelectedMethod(null);
    setIsLoading(false);
    setVisibility('private');
  };

  const deleteAgent = async (agentId: string) => {
    if (!user) return;
    
    const agentToDelete = agents.find(a => a.id === agentId);
    if (!agentToDelete) return;
    
    if (agentToDelete.ownerId !== user.id) {
      alert('Apenas o criador pode excluir este agente.');
      return;
    }
    
    if (!confirm('Tem certeza que deseja excluir este agente?')) return;
    
    try {
      console.log('🗑️ Deletando agente:', agentId);
      await deleteDoc(doc(db, 'agents', agentId));
      
      setAgents(prev => prev.filter(a => a.id !== agentId));
      console.log('✅ Agente deletado com sucesso');
      alert('Agente excluído com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao deletar agente:', error);
      alert('Erro ao excluir agente');
    }
  };

  const openEditModal = (agent: Agent) => {
    if (!user || agent.ownerId !== user.id) {
      alert('Apenas o criador pode editar este agente.');
      return;
    }
    
    setEditingAgent(agent);
    setShowEditModal(true);
  };

  const saveAgentEdit = async () => {
    if (!user || !editingAgent) return;
    
    if (!editingAgent.name.trim()) {
      alert('O nome do agente é obrigatório');
      return;
    }
    
    if (!editingAgent.systemPrompt.trim()) {
      alert('O prompt do sistema é obrigatório');
      return;
    }
    
    try {
      console.log('💾 Atualizando agente:', editingAgent.id);
      
      await updateDoc(doc(db, 'agents', editingAgent.id), {
        name: editingAgent.name.trim(),
        description: editingAgent.description?.trim() || '',
        systemPrompt: editingAgent.systemPrompt.trim(),
        visibility: editingAgent.visibility,
        sectorId: editingAgent.visibility === 'sector' ? user.sectorId : null,
        updatedAt: serverTimestamp()
      });
      
      // Update local state
      setAgents(prev => prev.map(a => 
        a.id === editingAgent.id ? { ...a, ...editingAgent } : a
      ));
      
      setShowEditModal(false);
      setEditingAgent(null);
      console.log('✅ Agente atualizado com sucesso');
      alert('Agente atualizado com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao atualizar agente:', error);
      alert('Erro ao atualizar agente');
    }
  };

  // Filter agents based on search and visibility
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesVisibility = visibilityFilter === 'all' ||
                             (visibilityFilter === 'private' && agent.visibility === 'private') ||
                             (visibilityFilter === 'sector' && agent.visibility === 'sector');
    
    return matchesSearch && matchesVisibility;
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-50 to-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Agentes IA</h1>
              <p className="text-gray-600 mt-1">
                Crie e gerencie agentes especializados para diferentes tarefas
              </p>
            </div>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-3 bg-orange-600 hover:bg-orange-700 text-white px-6 py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl font-semibold transform hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              Novo Agente
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Search and Filter */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar agentes..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            
            {/* Filter Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setVisibilityFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  visibilityFilter === 'all'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setVisibilityFilter('private')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  visibilityFilter === 'private'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Lock className="w-4 h-4" />
                Pessoais
              </button>
              <button
                onClick={() => setVisibilityFilter('sector')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  visibilityFilter === 'sector'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Users className="w-4 h-4" />
                Setor
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Bot className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{agents.length}</div>
                <div className="text-gray-600 text-sm">Agentes Totais</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {agents.filter(a => a.visibility === 'private').length}
                </div>
                <div className="text-gray-600 text-sm">Pessoais</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {agents.filter(a => a.visibility === 'sector').length}
                </div>
                <div className="text-gray-600 text-sm">Do Setor</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{filteredAgents.length}</div>
                <div className="text-gray-600 text-sm">Filtrados</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Agents List */}
          <div className="lg:col-span-2 space-y-6">
            {loadingAgents ? (
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg p-8 text-center">
                <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Carregando agentes...</p>
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg p-8 text-center">
                <div className="w-20 h-20 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Bot className="w-10 h-10 text-orange-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {agents.length === 0 ? 'Nenhum agente criado ainda' : 'Nenhum agente encontrado'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {agents.length === 0 
                    ? 'Crie seu primeiro agente de IA para começar a automatizar suas conversas e processos'
                    : 'Tente ajustar os filtros de busca'
                  }
                </p>
                {agents.length === 0 && (
                  <button 
                    onClick={() => setShowCreateModal(true)}
                    className="bg-gradient-to-r from-orange-500 to-orange-600 hover:shadow-lg text-white px-8 py-4 rounded-xl transition-all font-semibold inline-flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Criar Primeiro Agente
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="bg-white rounded-2xl border border-gray-200 shadow-lg hover:shadow-xl transition-all p-6 group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Bot className="w-6 h-6 text-orange-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold text-gray-900 mb-1">{agent.name}</h3>
                          {agent.description && (
                            <p className="text-gray-600 text-sm mb-2">{agent.description}</p>
                          )}
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium ${
                              agent.visibility === 'private'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {agent.visibility === 'private' ? (
                                <>
                                  <Lock className="w-3 h-3" />
                                  Pessoal
                                </>
                              ) : (
                                <>
                                  <Users className="w-3 h-3" />
                                  Setor
                                </>
                              )}
                            </span>
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">
                              <FileText className="w-3 h-3" />
                              {agent.method === 'structured' ? 'Estruturado' : 'Framework'}
                            </span>
                            {agent.createdAt && (
                              <span className="text-xs text-gray-500">
                                {agent.createdAt.toDate?.()?.toLocaleDateString() || 'Recente'}
                              </span>
                            )}
                            {agent.visibility === 'sector' && agent.ownerName && (
                              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium ${
                                agent.ownerId === user?.id 
                                  ? 'bg-orange-50 text-orange-700' 
                                  : 'bg-blue-50 text-blue-700'
                              }`}>
                                <UserIcon className="w-3 h-3" />
                                {agent.ownerId === user?.id ? 'Criado por: Você' : `Criado por: ${agent.ownerName}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Show edit/delete buttons only for agent owner */}
                      {user && agent.ownerId === user.id && (
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditModal(agent)}
                            className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar agente"
                          >
                            <Edit2 className="w-5 h-5 text-blue-600" />
                          </button>
                          <button
                            onClick={() => deleteAgent(agent.id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir agente"
                          >
                            <Trash2 className="w-5 h-5 text-red-600" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
              <h3 className="font-bold text-lg mb-4 text-gray-900">Ações Rápidas</h3>
              <div className="space-y-3">
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="w-full flex items-center gap-3 p-3 text-left text-gray-700 hover:bg-orange-50 rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5 text-orange-500" />
                  <span className="font-medium">Novo Agente</span>
                </button>
                <button className="w-full flex items-center gap-3 p-3 text-left text-gray-700 hover:bg-blue-50 rounded-lg transition-colors">
                  <Settings className="w-5 h-5 text-blue-500" />
                  <span className="font-medium">Configurações</span>
                </button>
                <button className="w-full flex items-center gap-3 p-3 text-left text-gray-700 hover:bg-purple-50 rounded-lg transition-colors">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  <span className="font-medium">Templates</span>
                </button>
              </div>
            </div>

            {/* Tip Card */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-bold text-lg">Dica dos Agentes</h3>
              </div>
              <p className="text-orange-50 text-sm leading-relaxed">
                Crie agentes especializados para tarefas específicas como análise de dados,
                redação criativa ou suporte técnico.
              </p>
            </div>
          </div>
        </div>

        {/* Create Agent Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-8 space-y-6 my-8">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {creationStep !== 'method' && (
                    <button
                      onClick={() => {
                        setCreationStep('method');
                        setSelectedMethod(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <ArrowLeft className="w-6 h-6" />
                    </button>
                  )}
                  <h2 className="text-2xl font-bold text-gray-900">
                    {creationStep === 'method' && 'Escolha o Método de Criação'}
                    {creationStep === 'structured' && 'Método: Prompt Estruturado'}
                    {creationStep === 'framework' && 'Método: Framework FGAC'}
                  </h2>
                </div>
                <button
                  onClick={resetModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Method Selection */}
              {creationStep === 'method' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Método Estruturado */}
                  <button
                    onClick={() => {
                      setSelectedMethod('structured');
                      setCreationStep('structured');
                    }}
                    className="text-left p-6 border-2 border-gray-200 rounded-2xl hover:border-orange-500 hover:shadow-lg transition-all group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center group-hover:bg-orange-500 transition-colors">
                        <FileText className="w-6 h-6 text-orange-600 group-hover:text-white" />
                      </div>
                      <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-orange-500" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Prompt Estruturado</h3>
                    <p className="text-gray-600 text-sm mb-4">
                      Criação técnica e detalhada do comportamento do agente usando estrutura de prompt profissional.
                    </p>
                    <div className="flex items-center gap-2 text-sm text-orange-600 font-medium">
                      <span>Ideal para agentes únicos</span>
                    </div>
                  </button>

                  {/* Framework FGAC */}
                  <button
                    onClick={() => {
                      setSelectedMethod('framework');
                      setCreationStep('framework');
                    }}
                    className="text-left p-6 border-2 border-gray-200 rounded-2xl hover:border-orange-500 hover:shadow-lg transition-all group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                        <Building2 className="w-6 h-6 text-blue-600 group-hover:text-white" />
                      </div>
                      <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-orange-500" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Framework FGAC</h3>
                    <p className="text-gray-600 text-sm mb-4">
                      Framework de Governança de Agentes Corporativos para criação escalável e padronizada.
                    </p>
                    <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                      <span>Ideal para múltiplos agentes corporativos</span>
                    </div>
                  </button>
                </div>
              )}

              {/* Structured Method Form */}
              {creationStep === 'structured' && (
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <p className="text-sm text-orange-800">
                      <strong>Método Prompt Estruturado:</strong> Preencha os campos para criar um agente com comportamento técnico e detalhado.
                    </p>
                  </div>

                  {/* Visibilidade */}
                  <div className="space-y-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      VISIBILIDADE
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setVisibility('private')}
                        className={`p-4 border-2 rounded-xl transition-all ${
                          visibility === 'private'
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            visibility === 'private' ? 'border-orange-500' : 'border-gray-300'
                          }`}>
                            {visibility === 'private' && <div className="w-3 h-3 rounded-full bg-orange-500" />}
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-gray-900">Pessoal</div>
                            <div className="text-sm text-gray-600">Apenas você terá acesso</div>
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisibility('sector')}
                        disabled={!user?.sectorId}
                        className={`p-4 border-2 rounded-xl transition-all ${
                          visibility === 'sector'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        } ${!user?.sectorId ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            visibility === 'sector' ? 'border-blue-500' : 'border-gray-300'
                          }`}>
                            {visibility === 'sector' && <div className="w-3 h-3 rounded-full bg-blue-500" />}
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-gray-900">Setor</div>
                            <div className="text-sm text-gray-600">
                              {user?.sectorId ? 'Todo o setor terá acesso' : 'Você não está em um setor'}
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Section 1: PAPEL/IDENTIDADE */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-8 h-8 bg-orange-500 text-white rounded-lg flex items-center justify-center text-sm">1</span>
                      PAPEL/IDENTIDADE
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Agente *</label>
                        <input
                          type="text"
                          value={structuredData.name}
                          onChange={(e) => setStructuredData({...structuredData, name: e.target.value})}
                          placeholder="Ex: Ava"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Profissão/Título *</label>
                        <input
                          type="text"
                          value={structuredData.role}
                          onChange={(e) => setStructuredData({...structuredData, role: e.target.value})}
                          placeholder="Ex: Assistente de Vendas"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Personalidade *</label>
                        <input
                          type="text"
                          value={structuredData.personality}
                          onChange={(e) => setStructuredData({...structuredData, personality: e.target.value})}
                          placeholder="Ex: prestativa, formal, engraçada"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Área de Expertise *</label>
                        <input
                          type="text"
                          value={structuredData.expertise}
                          onChange={(e) => setStructuredData({...structuredData, expertise: e.target.value})}
                          placeholder="Ex: Marketing Digital"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: OBJETIVO/TAREFA */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-8 h-8 bg-orange-500 text-white rounded-lg flex items-center justify-center text-sm">2</span>
                      OBJETIVO/TAREFA
                    </h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tarefa Principal *</label>
                      <textarea
                        value={structuredData.task}
                        onChange={(e) => setStructuredData({...structuredData, task: e.target.value})}
                        placeholder="Ex: ajudar o usuário a criar campanhas de marketing eficazes"
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                      />
                    </div>
                  </div>

                  {/* Section 3: PÚBLICO-ALVO */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-8 h-8 bg-orange-500 text-white rounded-lg flex items-center justify-center text-sm">3</span>
                      PÚBLICO-ALVO
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nível do Usuário *</label>
                        <input
                          type="text"
                          value={structuredData.audience}
                          onChange={(e) => setStructuredData({...structuredData, audience: e.target.value})}
                          placeholder="Ex: iniciante absoluto"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Estilo de Linguagem *</label>
                        <input
                          type="text"
                          value={structuredData.language}
                          onChange={(e) => setStructuredData({...structuredData, language: e.target.value})}
                          placeholder="Ex: informal, técnica, didática"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 4: RESTRIÇÕES/REGRAS */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-8 h-8 bg-orange-500 text-white rounded-lg flex items-center justify-center text-sm">4</span>
                      RESTRIÇÕES/REGRAS
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">NUNCA deve *</label>
                        <input
                          type="text"
                          value={structuredData.constraints.never}
                          onChange={(e) => setStructuredData({...structuredData, constraints: {...structuredData.constraints, never: e.target.value}})}
                          placeholder="Ex: inventar fatos ou revelar informações pessoais"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">SEMPRE deve *</label>
                        <input
                          type="text"
                          value={structuredData.constraints.always}
                          onChange={(e) => setStructuredData({...structuredData, constraints: {...structuredData.constraints, always: e.target.value}})}
                          placeholder="Ex: pedir confirmação antes de ações importantes"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Outras Limitações</label>
                        <input
                          type="text"
                          value={structuredData.constraints.limits}
                          onChange={(e) => setStructuredData({...structuredData, constraints: {...structuredData.constraints, limits: e.target.value}})}
                          placeholder="Ex: Responder apenas em português"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 5: FORMATO DE SAÍDA */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-8 h-8 bg-orange-500 text-white rounded-lg flex items-center justify-center text-sm">5</span>
                      FORMATO DE SAÍDA
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Elemento de Início *</label>
                        <input
                          type="text"
                          value={structuredData.outputFormat.start}
                          onChange={(e) => setStructuredData({...structuredData, outputFormat: {...structuredData.outputFormat, start: e.target.value}})}
                          placeholder="Ex: saudação e breve resumo"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Formatação *</label>
                        <input
                          type="text"
                          value={structuredData.outputFormat.formatting}
                          onChange={(e) => setStructuredData({...structuredData, outputFormat: {...structuredData.outputFormat, formatting: e.target.value}})}
                          placeholder="Ex: negrito e listas numeradas"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Framework Method Form */}
              {creationStep === 'framework' && (
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-sm text-blue-800">
                      <strong>Framework FGAC:</strong> Crie agentes corporativos escaláveis com governança e padronização.
                    </p>
                  </div>

                  {/* Visibilidade */}
                  <div className="space-y-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      VISIBILIDADE
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setVisibility('private')}
                        className={`p-4 border-2 rounded-xl transition-all ${
                          visibility === 'private'
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            visibility === 'private' ? 'border-orange-500' : 'border-gray-300'
                          }`}>
                            {visibility === 'private' && <div className="w-3 h-3 rounded-full bg-orange-500" />}
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-gray-900">Pessoal</div>
                            <div className="text-sm text-gray-600">Apenas você terá acesso</div>
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisibility('sector')}
                        disabled={!user?.sectorId}
                        className={`p-4 border-2 rounded-xl transition-all ${
                          visibility === 'sector'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        } ${!user?.sectorId ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            visibility === 'sector' ? 'border-blue-500' : 'border-gray-300'
                          }`}>
                            {visibility === 'sector' && <div className="w-3 h-3 rounded-full bg-blue-500" />}
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-gray-900">Setor</div>
                            <div className="text-sm text-gray-600">
                              {user?.sectorId ? 'Todo o setor terá acesso' : 'Você não está em um setor'}
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Section A: IDENTIDADE E PROPÓSITO */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center text-sm">A</span>
                      IDENTIDADE E PROPÓSITO
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Agente *</label>
                        <input
                          type="text"
                          value={frameworkData.identity.name}
                          onChange={(e) => setFrameworkData({...frameworkData, identity: {...frameworkData.identity, name: e.target.value}})}
                          placeholder="Ex: Assistente de Suporte ao Cliente"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Título na Empresa *</label>
                        <input
                          type="text"
                          value={frameworkData.identity.title}
                          onChange={(e) => setFrameworkData({...frameworkData, identity: {...frameworkData.identity, title: e.target.value}})}
                          placeholder="Ex: Especialista em Logística"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Empresa *</label>
                        <input
                          type="text"
                          value={frameworkData.identity.company}
                          onChange={(e) => setFrameworkData({...frameworkData, identity: {...frameworkData.identity, company: e.target.value}})}
                          placeholder="Ex: Acme Corp"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Personalidade *</label>
                        <input
                          type="text"
                          value={frameworkData.identity.personality}
                          onChange={(e) => setFrameworkData({...frameworkData, identity: {...frameworkData.identity, personality: e.target.value}})}
                          placeholder="Ex: Assertivo e Amigável"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Qualidade Principal *</label>
                        <input
                          type="text"
                          value={frameworkData.identity.quality}
                          onChange={(e) => setFrameworkData({...frameworkData, identity: {...frameworkData.identity, quality: e.target.value}})}
                          placeholder="Ex: Focado em Dados"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section A2: TAREFA ESPECÍFICA */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center text-sm">A2</span>
                      TAREFA ESPECÍFICA
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Responsabilidade Principal *</label>
                        <textarea
                          value={frameworkData.task.responsibility}
                          onChange={(e) => setFrameworkData({...frameworkData, task: {...frameworkData.task, responsibility: e.target.value}})}
                          placeholder="Ex: Resolução de problemas de rastreamento de pedidos de forma autônoma"
                          rows={2}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Departamento *</label>
                          <input
                            type="text"
                            value={frameworkData.task.department}
                            onChange={(e) => setFrameworkData({...frameworkData, task: {...frameworkData.task, department: e.target.value}})}
                            placeholder="Ex: Atendimento ao Cliente"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Métrica de Sucesso *</label>
                          <input
                            type="text"
                            value={frameworkData.task.successMetric}
                            onChange={(e) => setFrameworkData({...frameworkData, task: {...frameworkData.task, successMetric: e.target.value}})}
                            placeholder="Ex: Diminuir tempo de resposta em 30%"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section A3: PÚBLICO */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center text-sm">A3</span>
                      PÚBLICO E NÍVEL DE CONHECIMENTO
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Usuário *</label>
                        <input
                          type="text"
                          value={frameworkData.audience.userType}
                          onChange={(e) => setFrameworkData({...frameworkData, audience: {...frameworkData.audience, userType: e.target.value}})}
                          placeholder="Ex: Clientes Finais, Colaboradores Internos"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nível de Conhecimento *</label>
                        <select
                          value={frameworkData.audience.knowledgeLevel}
                          onChange={(e) => setFrameworkData({...frameworkData, audience: {...frameworkData.audience, knowledgeLevel: e.target.value}})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="básico">Básico</option>
                          <option value="intermediário">Intermediário</option>
                          <option value="avançado">Avançado</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section B: GOVERNANÇA */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-8 h-8 bg-orange-500 text-white rounded-lg flex items-center justify-center text-sm">B</span>
                      GOVERNANÇA E REGRAS CORPORATIVAS
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Tom de Voz *</label>
                          <input
                            type="text"
                            value={frameworkData.governance.tone}
                            onChange={(e) => setFrameworkData({...frameworkData, governance: {...frameworkData.governance, tone: e.target.value}})}
                            placeholder="Ex: Profissional e Otimista"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Ação em Caso de Erro *</label>
                          <input
                            type="text"
                            value={frameworkData.governance.errorAction}
                            onChange={(e) => setFrameworkData({...frameworkData, governance: {...frameworkData.governance, errorAction: e.target.value}})}
                            placeholder="Ex: Pedir desculpas e escalar"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Proibições (NUNCA) *</label>
                        <textarea
                          value={frameworkData.governance.prohibitions}
                          onChange={(e) => setFrameworkData({...frameworkData, governance: {...frameworkData.governance, prohibitions: e.target.value}})}
                          placeholder="Ex: Compartilhar informações de salário ou PII"
                          rows={2}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Requisitos (SEMPRE) *</label>
                        <textarea
                          value={frameworkData.governance.requirements}
                          onChange={(e) => setFrameworkData({...frameworkData, governance: {...frameworkData.governance, requirements: e.target.value}})}
                          placeholder="Ex: Manter escopo limitado e usar apenas dados aprovados"
                          rows={2}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Tópicos Sensíveis</label>
                          <input
                            type="text"
                            value={frameworkData.governance.sensitiveTopics}
                            onChange={(e) => setFrameworkData({...frameworkData, governance: {...frameworkData.governance, sensitiveTopics: e.target.value}})}
                            placeholder="Ex: Jurídico, Financeiro"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Resposta Padrão para Sensíveis</label>
                          <input
                            type="text"
                            value={frameworkData.governance.standardResponse}
                            onChange={(e) => setFrameworkData({...frameworkData, governance: {...frameworkData.governance, standardResponse: e.target.value}})}
                            placeholder="Ex: Consulte seu gerente"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section OUTPUT */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-8 h-8 bg-green-500 text-white rounded-lg flex items-center justify-center text-sm">C</span>
                      FORMATO DE SAÍDA
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Saudação Inicial *</label>
                        <input
                          type="text"
                          value={frameworkData.output.greeting}
                          onChange={(e) => setFrameworkData({...frameworkData, output: {...frameworkData.output, greeting: e.target.value}})}
                          placeholder="Ex: Olá! Como seu [Título] posso te ajudar..."
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Formatação *</label>
                        <input
                          type="text"
                          value={frameworkData.output.formatting}
                          onChange={(e) => setFrameworkData({...frameworkData, output: {...frameworkData.output, formatting: e.target.value}})}
                          placeholder="Ex: Listas numeradas e negrito"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              {creationStep !== 'method' && (
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={resetModal}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateAgent}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                  >
                    Criar Agente
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Edit Agent Modal */}
        {showEditModal && editingAgent && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-2xl font-bold text-gray-900">Editar Agente</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingAgent(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Agente *
                  </label>
                  <input
                    type="text"
                    value={editingAgent.name}
                    onChange={(e) => setEditingAgent({...editingAgent, name: e.target.value})}
                    placeholder="Ex: Assistente de Vendas"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição (opcional)
                  </label>
                  <textarea
                    value={editingAgent.description || ''}
                    onChange={(e) => setEditingAgent({...editingAgent, description: e.target.value})}
                    placeholder="Descreva brevemente o propósito deste agente..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* System Prompt */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prompt do Sistema (Instruções de Comportamento) *
                  </label>
                  <textarea
                    value={editingAgent.systemPrompt}
                    onChange={(e) => setEditingAgent({...editingAgent, systemPrompt: e.target.value})}
                    placeholder="Digite as instruções completas de como o agente deve se comportar..."
                    rows={12}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Este é o prompt que define todo o comportamento do agente. Seja específico e detalhado.
                  </p>
                </div>

                {/* Visibility */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Visibilidade *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setEditingAgent({...editingAgent, visibility: 'private'})}
                      className={`p-4 border-2 rounded-xl transition-all ${
                        editingAgent.visibility === 'private'
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-orange-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Lock className={`w-5 h-5 ${
                          editingAgent.visibility === 'private' ? 'text-orange-600' : 'text-gray-400'
                        }`} />
                        <div className="text-left">
                          <div className="font-semibold text-gray-900">Pessoal</div>
                          <div className="text-xs text-gray-600">Apenas você</div>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setEditingAgent({...editingAgent, visibility: 'sector'})}
                      disabled={!user?.sectorId}
                      className={`p-4 border-2 rounded-xl transition-all ${
                        editingAgent.visibility === 'sector'
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-orange-300'
                      } ${!user?.sectorId ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <Users className={`w-5 h-5 ${
                          editingAgent.visibility === 'sector' ? 'text-orange-600' : 'text-gray-400'
                        }`} />
                        <div className="text-left">
                          <div className="font-semibold text-gray-900">Setor</div>
                          <div className="text-xs text-gray-600">Todo o setor</div>
                        </div>
                      </div>
                    </button>
                  </div>
                  {!user?.sectorId && (
                    <p className="text-sm text-orange-600 mt-2">
                      Você precisa estar em um setor para criar agentes compartilhados
                    </p>
                  )}
                </div>


              </div>

              {/* Footer Actions */}
              <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingAgent(null);
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveAgentEdit}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
