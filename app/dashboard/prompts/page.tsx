'use client';

import { FileText, Plus, Sparkles, BookOpen, Star, Clock, Search, X, ChevronRight, ArrowLeft, Info, Users, Zap, Lock, Edit, Trash2, Copy, Eye, MessageSquare } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { Prompt } from '@/types';

type CreationStep = 'method' | 'simple' | 'metadata' | 'core' | 'review';
type PromptMethod = 'simple' | 'framework' | null;

interface PromptsStats {
  totalPrompts: number;
  totalCategories: number;
  totalUsage: number;
  recentPrompts: Prompt[];
}

export default function PromptsPage() {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creationStep, setCreationStep] = useState<CreationStep>('method');
  const [selectedMethod, setSelectedMethod] = useState<PromptMethod>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'private' | 'sector'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [visibility, setVisibility] = useState<'private' | 'sector'>('private');
  const [stats, setStats] = useState<PromptsStats>({
    totalPrompts: 0,
    totalCategories: 0,
    totalUsage: 0,
    recentPrompts: []
  });
  const [loadingStats, setLoadingStats] = useState(true);
  
  // Estados para CRUD
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState<Prompt | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingPrompt, setViewingPrompt] = useState<Prompt | null>(null);

  // Dados do Prompt Simples (Mini-Framework)
  const [simplePromptData, setSimplePromptData] = useState({
    name: '',
    role: '',
    task: '',
    constraints: '',
    format: ''
  });

  // Dados do Framework FCOP
  const [promptData, setPromptData] = useState({
    // A. METADADOS
    metadata: {
      id: '',
      name: '',
      sector: '',
      agent: '',
      date: new Date().toISOString().split('T')[0],
      status: 'em_teste'
    },
    // B. PROMPT CORE
    core: {
      context: '',
      task: '',
      constraints: '',
      input: '',
      outputFormat: ''
    },
    // C. RASTREABILIDADE
    testing: {
      notes: ''
    }
  });

  // Carregar estatísticas dos prompts
  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        setLoadingStats(true);
        console.log('📊 Carregando estatísticas de prompts para usuário:', user.id);

        // Buscar prompts do usuário
        const promptsQuery = query(
          collection(db, 'prompts'),
          where('ownerId', '==', user.id)
        );
        const promptsSnapshot = await getDocs(promptsQuery);
        const totalPrompts = promptsSnapshot.size;
        console.log('📝 Total de prompts:', totalPrompts);

        // Buscar prompts recentes
        const recentPromptsQuery = query(
          collection(db, 'prompts'),
          where('ownerId', '==', user.id),
          orderBy('createdAt', 'desc')
        );
        const recentPromptsSnapshot = await getDocs(recentPromptsQuery);
        const recentPrompts = recentPromptsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Prompt[];

        // Calcular categorias únicas
        const categories = new Set(recentPrompts.map(p => p.category).filter(Boolean));
        const totalCategories = categories.size;

        // Calcular total de usos
        const totalUsage = recentPrompts.reduce((sum, p) => sum + (p.usageCount || 0), 0);

        console.log('📊 Estatísticas:', {
          totalPrompts,
          totalCategories,
          totalUsage,
          recentPromptsCount: recentPrompts.length
        });

        setStats({
          totalPrompts,
          totalCategories,
          totalUsage,
          recentPrompts
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

  const handleCreatePrompt = async () => {
    if (!user) {
      alert('Você precisa estar autenticado para criar um prompt');
      return;
    }

    if (!promptData.metadata.name.trim()) {
      alert('Por favor, preencha o nome do prompt');
      return;
    }

    setIsLoading(true);

    try {
      console.log('📝 Criando prompt no Firestore...');

      // Construir o prompt completo formatado
      const fullPrompt = `# FRAMEWORK FCOP - ${promptData.metadata.name}

## METADADOS
- ID: ${promptData.metadata.id}
- Nome: ${promptData.metadata.name}
- Setor: ${promptData.metadata.sector}
- Agente: ${promptData.metadata.agent}
- Status: ${promptData.metadata.status}
- Data: ${promptData.metadata.date}

## PROMPT CORE

### CONTEXTO (Background)
${promptData.core.context}

### INSTRUÇÃO/TAREFA
${promptData.core.task}

### RESTRIÇÕES (Constraints)
${promptData.core.constraints}

### ENTRADA DE DADOS (Input)
${promptData.core.input}

### FORMATO DE SAÍDA (Output)
${promptData.core.outputFormat}

## RASTREABILIDADE
${promptData.testing.notes}`;

      const promptDoc = {
        title: promptData.metadata.name,
        content: fullPrompt,
        category: promptData.metadata.sector,
        tags: [promptData.metadata.status, promptData.metadata.sector].filter(Boolean),
        visibility: visibility,
        ownerId: user.id,
        ownerName: user.name,
        sectorId: user.sectorId,
        allowedUsers: visibility === 'sector' ? [] : [user.id],
        usageCount: 0,
        metadata: promptData.metadata,
        core: promptData.core,
        testing: promptData.testing,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'prompts'), promptDoc);
      
      console.log('✅ Prompt criado com sucesso! ID:', docRef.id);
      alert(`Prompt "${promptData.metadata.name}" criado com sucesso!`);
      
      // Recarregar estatísticas
      const updatedPromptsQuery = query(
        collection(db, 'prompts'),
        where('ownerId', '==', user.id)
      );
      const updatedSnapshot = await getDocs(updatedPromptsQuery);
      const updatedPrompts = updatedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Prompt[];
      
      const categories = new Set(updatedPrompts.map(p => p.category).filter(Boolean));
      const totalUsage = updatedPrompts.reduce((sum, p) => sum + (p.usageCount || 0), 0);
      
      setStats({
        totalPrompts: updatedPrompts.length,
        totalCategories: categories.size,
        totalUsage,
        recentPrompts: updatedPrompts
      });
      
      resetModal();
    } catch (error) {
      console.error('❌ Erro ao criar prompt:', error);
      alert(`Erro ao criar prompt: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSimplePrompt = async () => {
    if (!user) {
      alert('Você precisa estar autenticado para criar um prompt');
      return;
    }

    if (!simplePromptData.name.trim()) {
      alert('Por favor, preencha o nome do prompt');
      return;
    }

    if (!simplePromptData.role.trim() || !simplePromptData.task.trim()) {
      alert('Por favor, preencha pelo menos o PAPEL e a TAREFA');
      return;
    }

    setIsLoading(true);

    try {
      console.log('📝 Criando prompt simples no Firestore...');

      // Construir o prompt usando o Mini-Framework
      const fullPrompt = `# ${simplePromptData.name}

## MINI-FRAMEWORK UNIVERSAL

### 1. PAPEL
Você é ${simplePromptData.role}

### 2. TAREFA
${simplePromptData.task}

${simplePromptData.constraints ? `### 3. RESTRIÇÕES\n${simplePromptData.constraints}\n` : ''}
${simplePromptData.format ? `### 4. FORMATO\n${simplePromptData.format}` : ''}`;

      const promptDoc = {
        title: simplePromptData.name,
        content: fullPrompt,
        category: 'Simple',
        tags: ['mini-framework', 'simple'],
        visibility: visibility,
        ownerId: user.id,
        ownerName: user.name,
        sectorId: user.sectorId,
        allowedUsers: visibility === 'sector' ? [] : [user.id],
        usageCount: 0,
        method: 'simple',
        simpleData: simplePromptData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'prompts'), promptDoc);
      
      console.log('✅ Prompt simples criado com sucesso! ID:', docRef.id);
      alert(`Prompt "${simplePromptData.name}" criado com sucesso!`);
      
      // Recarregar estatísticas
      const updatedPromptsQuery = query(
        collection(db, 'prompts'),
        where('ownerId', '==', user.id)
      );
      const updatedSnapshot = await getDocs(updatedPromptsQuery);
      const updatedPrompts = updatedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Prompt[];
      
      const categories = new Set(updatedPrompts.map(p => p.category).filter(Boolean));
      const totalUsage = updatedPrompts.reduce((sum, p) => sum + (p.usageCount || 0), 0);
      
      setStats({
        totalPrompts: updatedPrompts.length,
        totalCategories: categories.size,
        totalUsage,
        recentPrompts: updatedPrompts
      });
      
      resetModal();
    } catch (error) {
      console.error('❌ Erro ao criar prompt:', error);
      alert(`Erro ao criar prompt: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Função para editar prompt
  const handleUpdatePrompt = async (updatedData: Partial<Prompt>) => {
    if (!editingPrompt || !user) return;

    try {
      setIsLoading(true);
      console.log('✏️ Atualizando prompt:', editingPrompt.id);

      const promptRef = doc(db, 'prompts', editingPrompt.id);
      await updateDoc(promptRef, {
        ...updatedData,
        updatedAt: serverTimestamp()
      });

      // Atualizar localmente
      const updatedPrompts = stats.recentPrompts.map(p => 
        p.id === editingPrompt.id ? { ...p, ...updatedData } : p
      );

      setStats(prev => ({
        ...prev,
        recentPrompts: updatedPrompts
      }));

      setEditingPrompt(null);
      setShowCreateModal(false);
      console.log('✅ Prompt atualizado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao atualizar prompt:', error);
      alert('Erro ao atualizar prompt');
    } finally {
      setIsLoading(false);
    }
  };

  // Função para deletar prompt
  const handleDeletePrompt = async () => {
    if (!promptToDelete || !user) return;

    try {
      setIsLoading(true);
      console.log('🗑️ Deletando prompt:', promptToDelete.id);

      await deleteDoc(doc(db, 'prompts', promptToDelete.id));

      // Atualizar localmente
      const updatedPrompts = stats.recentPrompts.filter(p => p.id !== promptToDelete.id);
      const categories = new Set(updatedPrompts.map(p => p.category).filter(Boolean));
      const totalUsage = updatedPrompts.reduce((sum, p) => sum + (p.usageCount || 0), 0);

      setStats({
        totalPrompts: updatedPrompts.length,
        totalCategories: categories.size,
        totalUsage,
        recentPrompts: updatedPrompts
      });

      setShowDeleteConfirm(false);
      setPromptToDelete(null);
      console.log('✅ Prompt deletado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao deletar prompt:', error);
      alert('Erro ao deletar prompt');
    } finally {
      setIsLoading(false);
    }
  };

  // Função para copiar prompt
  const handleCopyPrompt = async (prompt: Prompt) => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      alert('Prompt copiado para a área de transferência!');
    } catch (error) {
      console.error('❌ Erro ao copiar prompt:', error);
      alert('Erro ao copiar prompt');
    }
  };

  // Função para usar prompt (navegar para nova conversa)
  const handleUsePrompt = (prompt: Prompt) => {
    localStorage.setItem('selectedPrompt', JSON.stringify(prompt));
    window.location.href = '/dashboard/new';
  };

  const resetModal = () => {
    setShowCreateModal(false);
    setCreationStep('method');
    setSelectedMethod(null);
    setIsLoading(false);
    setVisibility('private');
    setEditingPrompt(null);
    setSimplePromptData({
      name: '',
      role: '',
      task: '',
      constraints: '',
      format: ''
    });
    setPromptData({
      metadata: {
        id: '',
        name: '',
        sector: '',
        agent: '',
        date: new Date().toISOString().split('T')[0],
        status: 'em_teste'
      },
      core: {
        context: '',
        task: '',
        constraints: '',
        input: '',
        outputFormat: ''
      },
      testing: {
        notes: ''
      }
    });
  };

  // Filtrar prompts
  const filteredPrompts = stats.recentPrompts.filter(prompt => {
    const matchesSearch = prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prompt.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVisibility = visibilityFilter === 'all' || prompt.visibility === visibilityFilter;
    return matchesSearch && matchesVisibility;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Prompts</h1>
              <p className="text-gray-600 mt-1">
                Biblioteca de prompts reutilizáveis para suas conversas
              </p>
            </div>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:shadow-lg text-white px-6 py-4 rounded-xl transition-all font-semibold"
            >
              <Plus className="w-5 h-5" />
              Novo Prompt
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
                placeholder="Pesquisar prompts..."
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
                <FileText className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {loadingStats ? '...' : stats.totalPrompts}
                </div>
                <div className="text-gray-600 text-sm">Prompts Salvos</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {loadingStats ? '...' : stats.totalCategories}
                </div>
                <div className="text-gray-600 text-sm">Categorias</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Star className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {loadingStats ? '...' : stats.recentPrompts.filter(p => p.visibility === 'private').length}
                </div>
                <div className="text-gray-600 text-sm">Pessoais</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {loadingStats ? '...' : stats.totalUsage}
                </div>
                <div className="text-gray-600 text-sm">Usos Totais</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Prompts List */}
          <div className="lg:col-span-2 space-y-6">
            {loadingStats ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 text-center">
                <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-gray-600 mt-4">Carregando prompts...</p>
              </div>
            ) : filteredPrompts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 text-center">
                <div className="w-20 h-20 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-10 h-10 text-orange-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {searchTerm || visibilityFilter !== 'all' 
                    ? 'Nenhum prompt encontrado' 
                    : 'Nenhum prompt salvo ainda'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm || visibilityFilter !== 'all'
                    ? 'Tente ajustar os filtros de busca'
                    : 'Crie prompts para reutilizar em suas conversas'}
                </p>
                {!searchTerm && visibilityFilter === 'all' && (
                  <button 
                    onClick={() => setShowCreateModal(true)}
                    className="bg-gradient-to-r from-orange-500 to-orange-600 hover:shadow-lg text-white px-8 py-4 rounded-xl transition-all font-semibold inline-flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Criar Primeiro Prompt
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPrompts.map((prompt) => (
                  <div 
                    key={prompt.id}
                    className="bg-white rounded-2xl border border-gray-200 shadow-lg hover:shadow-xl transition-all p-6"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-900">{prompt.title}</h3>
                          {prompt.visibility === 'private' ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                              <Lock className="w-3 h-3" />
                              Pessoal
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                              <Users className="w-3 h-3" />
                              Setor
                            </span>
                          )}
                        </div>
                        {prompt.category && (
                          <span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium mb-2">
                            {prompt.category}
                          </span>
                        )}
                        <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                          {prompt.content.substring(0, 150)}...
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {prompt.usageCount || 0} usos
                          </span>
                          <span>
                            Criado em {(() => {
                              const date = prompt.createdAt as any;
                              if (date?.toDate) return date.toDate().toLocaleDateString('pt-BR');
                              if (date instanceof Date) return date.toLocaleDateString('pt-BR');
                              return 'Data não disponível';
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => handleUsePrompt(prompt)}
                        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:shadow-lg text-white px-4 py-2 rounded-lg transition-all font-medium text-sm"
                      >
                        <Sparkles className="w-4 h-4" />
                        Usar
                      </button>
                      <button
                        onClick={() => {
                          setViewingPrompt(prompt);
                          setShowViewModal(true);
                        }}
                        className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-all font-medium text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        Ver
                      </button>
                      <button
                        onClick={() => handleCopyPrompt(prompt)}
                        className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-all font-medium text-sm"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingPrompt(prompt);
                          setShowCreateModal(true);
                        }}
                        className="flex items-center justify-center gap-2 bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg transition-all font-medium text-sm"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setPromptToDelete(prompt);
                          setShowDeleteConfirm(true);
                        }}
                        className="flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg transition-all font-medium text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Search */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar prompts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Categories */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
              <h3 className="font-bold text-lg mb-4 text-gray-900">Categorias</h3>
              <div className="space-y-2">
                <button className="w-full text-left px-3 py-2 text-gray-700 hover:bg-orange-50 rounded-lg transition-colors">
                  Criativo
                </button>
                <button className="w-full text-left px-3 py-2 text-gray-700 hover:bg-orange-50 rounded-lg transition-colors">
                  Técnico
                </button>
                <button className="w-full text-left px-3 py-2 text-gray-700 hover:bg-orange-50 rounded-lg transition-colors">
                  Educacional
                </button>
                <button className="w-full text-left px-3 py-2 text-gray-700 hover:bg-orange-50 rounded-lg transition-colors">
                  Profissional
                </button>
              </div>
            </div>

            {/* Tip Card */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-bold text-lg">Dica dos Prompts</h3>
              </div>
              <p className="text-orange-50 text-sm leading-relaxed">
                Organize seus prompts em categorias e use descrições claras para
                encontrar rapidamente o que precisa.
              </p>
            </div>
          </div>
        </div>

        {/* Create Prompt Modal - Framework FCOP */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-8 space-y-6 my-8">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {creationStep !== 'method' && (
                    <button
                      onClick={() => {
                        if (creationStep === 'metadata') setCreationStep('method');
                        else if (creationStep === 'core') setCreationStep('metadata');
                        else if (creationStep === 'review') setCreationStep('core');
                      }}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <ArrowLeft className="w-6 h-6" />
                    </button>
                  )}
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {creationStep === 'method' && 'Escolha o Método'}
                      {creationStep === 'metadata' && 'Metadados do Prompt'}
                      {creationStep === 'core' && 'Prompt Core'}
                      {creationStep === 'review' && 'Revisão e Testes'}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Framework de Catalogação e Otimização de Prompts
                    </p>
                  </div>
                </div>
                <button
                  onClick={resetModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Progress Indicator */}
              {creationStep !== 'method' && (
                <div className="flex items-center gap-2">
                  <div className={`flex-1 h-2 rounded-full ${creationStep === 'metadata' || creationStep === 'core' || creationStep === 'review' ? 'bg-orange-500' : 'bg-gray-200'}`} />
                  <div className={`flex-1 h-2 rounded-full ${creationStep === 'core' || creationStep === 'review' ? 'bg-orange-500' : 'bg-gray-200'}`} />
                  <div className={`flex-1 h-2 rounded-full ${creationStep === 'review' ? 'bg-orange-500' : 'bg-gray-200'}`} />
                </div>
              )}

              {/* Start Screen */}
              {creationStep === 'method' && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Como deseja criar seu prompt?</h3>
                    <p className="text-gray-600">Escolha o método mais adequado para suas necessidades</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Simple Method */}
                    <button
                      onClick={() => {
                        setSelectedMethod('simple');
                        setCreationStep('simple');
                      }}
                      className="group p-6 border-2 border-gray-200 hover:border-orange-500 rounded-2xl transition-all text-left hover:shadow-lg"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-orange-100 group-hover:bg-orange-500 rounded-xl flex items-center justify-center transition-colors flex-shrink-0">
                          <Zap className="w-8 h-8 text-orange-600 group-hover:text-white transition-colors" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-900 mb-2">Prompt Simples</h3>
                          <p className="text-sm text-gray-600 mb-4">
                            Método rápido usando o Mini-Framework Universal
                          </p>
                          <div className="space-y-1 text-xs text-gray-500">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                              <span>Nome + Papel + Tarefa</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                              <span>Restrições + Formato</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Framework Method */}
                    <button
                      onClick={() => {
                        setSelectedMethod('framework');
                        setCreationStep('metadata');
                      }}
                      className="group p-6 border-2 border-gray-200 hover:border-blue-500 rounded-2xl transition-all text-left hover:shadow-lg"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-blue-100 group-hover:bg-blue-500 rounded-xl flex items-center justify-center transition-colors flex-shrink-0">
                          <BookOpen className="w-8 h-8 text-blue-600 group-hover:text-white transition-colors" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-900 mb-2">Framework FCOP</h3>
                          <p className="text-sm text-gray-600 mb-4">
                            Método completo para prompts profissionais
                          </p>
                          <div className="space-y-1 text-xs text-gray-500">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                              <span>Metadados + Prompt Core</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                              <span>Rastreabilidade</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Simple Prompt Form */}
              {creationStep === 'simple' && (
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <p className="text-sm text-orange-800">
                      <strong>Mini-Framework Universal:</strong> Crie prompts eficazes rapidamente.
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

                  {/* Nome */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome do Prompt *
                    </label>
                    <input
                      type="text"
                      value={simplePromptData.name}
                      onChange={(e) => setSimplePromptData({...simplePromptData, name: e.target.value})}
                      placeholder="Ex: Criador de Títulos para Blog"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  {/* 1. PAPEL */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      <span className="font-bold text-orange-600">1. PAPEL</span> *
                    </label>
                    <input
                      type="text"
                      value={simplePromptData.role}
                      onChange={(e) => setSimplePromptData({...simplePromptData, role: e.target.value})}
                      placeholder="Ex: um Copywriter Criativo"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  {/* 2. TAREFA */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      <span className="font-bold text-orange-600">2. TAREFA</span> *
                    </label>
                    <textarea
                      value={simplePromptData.task}
                      onChange={(e) => setSimplePromptData({...simplePromptData, task: e.target.value})}
                      placeholder="Ex: Escreva uma introdução para um artigo"
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* 3. RESTRIÇÕES */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      <span className="font-bold text-orange-600">3. RESTRIÇÕES</span>
                    </label>
                    <textarea
                      value={simplePromptData.constraints}
                      onChange={(e) => setSimplePromptData({...simplePromptData, constraints: e.target.value})}
                      placeholder="Ex: Menos de 100 palavras. Sem linguagem informal"
                      rows={2}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* 4. FORMATO */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      <span className="font-bold text-orange-600">4. FORMATO</span>
                    </label>
                    <input
                      type="text"
                      value={simplePromptData.format}
                      onChange={(e) => setSimplePromptData({...simplePromptData, format: e.target.value})}
                      placeholder="Ex: Em uma lista de três itens"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {/* Step 1: Metadata */}
              {creationStep === 'metadata' && (
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-sm text-blue-800">
                      <strong>Seção A - METADADOS:</strong> Informações para catalogação e organização interna do prompt.
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

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ID do Prompt *
                        </label>
                        <input
                          type="text"
                          value={promptData.metadata.id}
                          onChange={(e) => setPromptData({...promptData, metadata: {...promptData.metadata, id: e.target.value}})}
                          placeholder="Ex: RH-AVAL-003"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Código único para identificação</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nome do Prompt *
                        </label>
                        <input
                          type="text"
                          value={promptData.metadata.name}
                          onChange={(e) => setPromptData({...promptData, metadata: {...promptData.metadata, name: e.target.value}})}
                          placeholder="Ex: Sumarizador de Entrevista"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Setor de Destino *
                        </label>
                        <input
                          type="text"
                          value={promptData.metadata.sector}
                          onChange={(e) => setPromptData({...promptData, metadata: {...promptData.metadata, sector: e.target.value}})}
                          placeholder="Ex: RH, Marketing, Vendas"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Agente de Destino
                        </label>
                        <input
                          type="text"
                          value={promptData.metadata.agent}
                          onChange={(e) => setPromptData({...promptData, metadata: {...promptData.metadata, agent: e.target.value}})}
                          placeholder="Ex: Agente Ava"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Data da Última Otimização
                        </label>
                        <input
                          type="date"
                          value={promptData.metadata.date}
                          onChange={(e) => setPromptData({...promptData, metadata: {...promptData.metadata, date: e.target.value}})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Status de Aprovação *
                        </label>
                        <select
                          value={promptData.metadata.status}
                          onChange={(e) => setPromptData({...promptData, metadata: {...promptData.metadata, status: e.target.value}})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="em_teste">Em Teste</option>
                          <option value="aprovado">Aprovado para Produção</option>
                          <option value="arquivado">Arquivado</option>
                          <option value="revisao">Em Revisão</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Prompt Core */}
              {creationStep === 'core' && (
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <p className="text-sm text-orange-800">
                      <strong>Seção B - PROMPT CORE:</strong> O conteúdo estruturado que será enviado ao modelo de IA.
                    </p>
                  </div>

                  <div className="space-y-6">
                    {/* B1. Contexto */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <span className="inline-flex items-center gap-2">
                          <span className="px-2 py-1 bg-orange-500 text-white text-xs rounded">B1</span>
                          Contexto (Background) *
                        </span>
                      </label>
                      <textarea
                        value={promptData.core.context}
                        onChange={(e) => setPromptData({...promptData, core: {...promptData.core, context: e.target.value}})}
                        placeholder='Ex: "Você é um assistente financeiro sênior. O objetivo é analisar o fluxo de caixa mensal."'
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">Defina o papel do agente e o cenário</p>
                    </div>

                    {/* B2. Tarefa */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <span className="inline-flex items-center gap-2">
                          <span className="px-2 py-1 bg-orange-500 text-white text-xs rounded">B2</span>
                          Instrução/Tarefa *
                        </span>
                      </label>
                      <textarea
                        value={promptData.core.task}
                        onChange={(e) => setPromptData({...promptData, core: {...promptData.core, task: e.target.value}})}
                        placeholder='Ex: "Calcule a margem líquida e identifique desvios de mais de 10% no orçamento."'
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">A ação principal. Use verbos fortes</p>
                    </div>

                    {/* B3. Restrições */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <span className="inline-flex items-center gap-2">
                          <span className="px-2 py-1 bg-orange-500 text-white text-xs rounded">B3</span>
                          Restrições (Constraints) *
                        </span>
                      </label>
                      <textarea
                        value={promptData.core.constraints}
                        onChange={(e) => setPromptData({...promptData, core: {...promptData.core, constraints: e.target.value}})}
                        placeholder='Ex: "A análise deve ser feita apenas em Reais (R$). Não use termos jurídicos."'
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">O que evitar ou regras a seguir</p>
                    </div>

                    {/* B4. Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <span className="inline-flex items-center gap-2">
                          <span className="px-2 py-1 bg-orange-500 text-white text-xs rounded">B4</span>
                          Entrada de Dados (Input) *
                        </span>
                      </label>
                      <textarea
                        value={promptData.core.input}
                        onChange={(e) => setPromptData({...promptData, core: {...promptData.core, input: e.target.value}})}
                        placeholder='Ex: "Analise os dados da planilha que segue: {DADOS_FLUXO_DE_CAIXA}"'
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">Onde o usuário insere a informação. Use variáveis como {'{NOME_VARIAVEL}'}</p>
                    </div>

                    {/* B5. Output Format */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <span className="inline-flex items-center gap-2">
                          <span className="px-2 py-1 bg-orange-500 text-white text-xs rounded">B5</span>
                          Formato de Saída (Output) *
                        </span>
                      </label>
                      <textarea
                        value={promptData.core.outputFormat}
                        onChange={(e) => setPromptData({...promptData, core: {...promptData.core, outputFormat: e.target.value}})}
                        placeholder='Ex: "Primeiro, liste a Margem Líquida. Segundo, apresente os desvios em uma tabela, ordenados por valor."'
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">Defina a estrutura de saída</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Review & Testing */}
              {creationStep === 'review' && (
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-sm text-green-800">
                      <strong>Seção C - RASTREABILIDADE:</strong> Registre os resultados dos testes para otimização contínua.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notas de Teste e Otimização
                    </label>
                    <textarea
                      value={promptData.testing.notes}
                      onChange={(e) => setPromptData({...promptData, testing: {...promptData.testing, notes: e.target.value}})}
                      placeholder="Registre aqui os resultados dos testes, ajustes necessários e observações importantes..."
                      rows={6}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Preview do Prompt Completo */}
                  <div className="border-2 border-gray-200 rounded-xl p-6 bg-gray-50">
                    <h3 className="font-bold text-gray-900 mb-4">Preview do Prompt Completo</h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-semibold text-gray-700">Visibilidade:</span>
                        <span className={`ml-2 px-3 py-1 rounded-full text-xs font-medium ${
                          visibility === 'private' 
                            ? 'bg-orange-100 text-orange-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {visibility === 'private' ? 'Pessoal' : 'Setor'}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">ID:</span>
                        <span className="ml-2 text-gray-600">{promptData.metadata.id || '(não definido)'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Nome:</span>
                        <span className="ml-2 text-gray-600">{promptData.metadata.name || '(não definido)'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Setor:</span>
                        <span className="ml-2 text-gray-600">{promptData.metadata.sector || '(não definido)'}</span>
                      </div>
                      <div className="pt-3 border-t">
                        <div className="font-mono text-xs bg-white p-4 rounded-lg border">
                          {promptData.core.context && <p className="mb-2"><strong>CONTEXTO:</strong> {promptData.core.context}</p>}
                          {promptData.core.task && <p className="mb-2"><strong>TAREFA:</strong> {promptData.core.task}</p>}
                          {promptData.core.constraints && <p className="mb-2"><strong>RESTRIÇÕES:</strong> {promptData.core.constraints}</p>}
                          {promptData.core.input && <p className="mb-2"><strong>INPUT:</strong> {promptData.core.input}</p>}
                          {promptData.core.outputFormat && <p><strong>OUTPUT:</strong> {promptData.core.outputFormat}</p>}
                        </div>
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
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <div className="flex-1" />
                  {creationStep === 'simple' && (
                    <button
                      onClick={handleCreateSimplePrompt}
                      disabled={isLoading}
                      className="px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      {isLoading ? 'Criando...' : 'Criar Prompt Simples'}
                    </button>
                  )}
                  {creationStep === 'metadata' && (
                    <button
                      onClick={() => setCreationStep('core')}
                      className="px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2"
                    >
                      Próximo: Prompt Core
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                  {creationStep === 'core' && (
                    <button
                      onClick={() => setCreationStep('review')}
                      className="px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2"
                    >
                      Próximo: Revisão
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                  {creationStep === 'review' && (
                    <button
                      onClick={handleCreatePrompt}
                      disabled={isLoading}
                      className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      {isLoading ? 'Criando...' : 'Criar Prompt'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal de Confirmação de Exclusão */}
        {showDeleteConfirm && promptToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
              <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
                Excluir Prompt?
              </h2>
              
              <p className="text-gray-600 text-center mb-6">
                Tem certeza que deseja excluir o prompt <strong>"{promptToDelete.title}"</strong>? 
                Esta ação não pode ser desfeita.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setPromptToDelete(null);
                  }}
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeletePrompt}
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:shadow-lg text-white rounded-xl font-semibold transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Visualização de Prompt */}
        {showViewModal && viewingPrompt && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-8 my-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{viewingPrompt.title}</h2>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingPrompt(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Metadados */}
                <div className="flex flex-wrap gap-2">
                  {viewingPrompt.visibility === 'private' ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                      <Lock className="w-4 h-4" />
                      Pessoal
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                      <Users className="w-4 h-4" />
                      Setor
                    </span>
                  )}
                  {viewingPrompt.category && (
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                      {viewingPrompt.category}
                    </span>
                  )}
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                    {viewingPrompt.usageCount || 0} usos
                  </span>
                </div>

                {/* Conteúdo do Prompt */}
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-orange-600" />
                    Conteúdo do Prompt
                  </h3>
                  <div className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                    {viewingPrompt.content}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      handleUsePrompt(viewingPrompt);
                      setShowViewModal(false);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:shadow-lg text-white px-6 py-3 rounded-xl transition-all font-semibold"
                  >
                    <Sparkles className="w-5 h-5" />
                    Usar Prompt
                  </button>
                  <button
                    onClick={() => {
                      handleCopyPrompt(viewingPrompt);
                    }}
                    className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl transition-all font-semibold"
                  >
                    <Copy className="w-5 h-5" />
                    Copiar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
