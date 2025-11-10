'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { WhatsAppConnection, WhatsAppTraining } from '@/types';
import { 
  BookOpen,
  Plus,
  Trash2,
  FileText,
  MessageSquare,
  Link as LinkIcon,
  Upload,
  X,
  Loader2,
  Edit2,
  Save,
  GripVertical
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type TrainingType = 'document' | 'qna' | 'prompt' | 'url';

// Componente SortableTrainingCard
interface SortableTrainingCardProps {
  training: WhatsAppTraining;
  position: number;
  onEdit: (training: WhatsAppTraining) => void;
  onDelete: (id: string) => void;
  getTypeInfo: (type: TrainingType) => any;
}

function SortableTrainingCard({ training, position, onEdit, onDelete, getTypeInfo }: SortableTrainingCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: training.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const typeInfo = getTypeInfo(training.type);
  const TypeIcon = typeInfo.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-lg border-2 p-4 ${
        isDragging ? 'border-orange-500 shadow-lg' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing mt-1 text-gray-400 hover:text-gray-600"
        >
          <GripVertical className="w-5 h-5" />
        </div>

        {/* Position Badge */}
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">
            #{position}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">{training.name}</h3>
              {training.description && (
                <p className="text-sm text-gray-600 mb-2">{training.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onEdit(training)}
                className="text-blue-600 hover:text-blue-700"
                title="Editar"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(training.id)}
                className="text-red-600 hover:text-red-700"
                title="Excluir"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            {/* Type Badge */}
            <span className={`inline-flex items-center gap-1 px-2 py-1 ${typeInfo.bg} ${typeInfo.color} rounded-full text-xs font-medium`}>
              <TypeIcon className="w-3 h-3" />
              {typeInfo.label}
            </span>

            {/* Mode Badge */}
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              training.mode === 'always' 
                ? 'bg-purple-100 text-purple-700' 
                : 'bg-blue-100 text-blue-700'
            }`}>
              {training.mode === 'always' ? '🟣 Sempre Ativo' : '🔵 Palavras-chave'}
            </span>

            {/* Priority Badge */}
            <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
              ⚡ Prioridade: {training.priority}
            </span>

            {/* Active Badge */}
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              training.isActive 
                ? 'bg-green-100 text-green-700' 
                : 'bg-gray-100 text-gray-700'
            }`}>
              {training.isActive ? '✅ Ativo' : '⏸️ Inativo'}
            </span>
          </div>

          {/* Keywords */}
          {training.mode === 'keywords' && training.keywords && training.keywords.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-gray-500 mb-1">
                Palavras-chave ({training.keywordsMatchType === 'any' ? 'Qualquer' : 'Todas'}):
              </div>
              <div className="flex flex-wrap gap-1">
                {training.keywords.map((keyword) => (
                  <span key={keyword} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WhatsAppTrainingPage() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [trainings, setTrainings] = useState<WhatsAppTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTrainingId, setEditingTrainingId] = useState<string | null>(null);
  const [trainingType, setTrainingType] = useState<TrainingType>('prompt');
  
  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  
  // NOVO: Estados para configuração multi-IA
  const [trainingName, setTrainingName] = useState('');
  const [trainingDescription, setTrainingDescription] = useState('');
  const [mode, setMode] = useState<'always' | 'keywords'>('keywords');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [keywordsMatchType, setKeywordsMatchType] = useState<'any' | 'all'>('any');
  const [exitKeywords, setExitKeywords] = useState<string[]>([]);
  const [exitKeywordInput, setExitKeywordInput] = useState('');
  const [exitMessage, setExitMessage] = useState('');
  const [inactivityTimeout, setInactivityTimeout] = useState<number>(0);
  const [priority, setPriority] = useState<number>(5);
  const [isActive, setIsActive] = useState<boolean>(true);

  // Drag & Drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadConnections();
  }, [user]);

  useEffect(() => {
    if (selectedConnectionId) {
      loadTrainings();
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

  const loadTrainings = async () => {
    if (!selectedConnectionId) return;

    try {
      const trainingsRef = collection(db, 'whatsapp_training');
      const q = query(
        trainingsRef,
        where('connectionId', '==', selectedConnectionId)
      );

      const snapshot = await getDocs(q);
      const loadedTrainings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WhatsAppTraining[];

      // Ordenar por prioridade em memória (maior primeiro)
      loadedTrainings.sort((a, b) => (b.priority || 0) - (a.priority || 0));

      setTrainings(loadedTrainings);
    } catch (error) {
      console.error('Erro ao carregar treinamentos:', error);
    }
  };

  const handleCreateTraining = async () => {
    if (!user || !selectedConnectionId || !title.trim() || !trainingName.trim()) {
      alert('Preencha o nome do treinamento e o título');
      return;
    }

    // Validação de palavras-chave se modo keywords
    if (mode === 'keywords' && keywords.length === 0) {
      alert('Adicione pelo menos uma palavra-chave para o modo "Palavras-chave"');
      return;
    }

    try {
      let trainingContent = '';
      let metadata = {};

      switch (trainingType) {
        case 'prompt':
          trainingContent = content;
          break;
        case 'qna':
          trainingContent = `Q: ${question}\nA: ${answer}`;
          metadata = { question, answer };
          break;
        case 'url':
          trainingContent = `URL: ${url}`;
          metadata = { url };
          break;
        case 'document':
          trainingContent = content;
          break;
      }

      const newTraining: Omit<WhatsAppTraining, 'id'> = {
        connectionId: selectedConnectionId,
        name: trainingName,
        description: trainingDescription,
        type: trainingType,
        title,
        content: trainingContent,
        metadata,
        mode,
        keywords,
        keywordsMatchType,
        exitKeywords,
        exitMessage,
        inactivityTimeout,
        priority,
        isActive,
        ownerId: user.uid || user.id,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'whatsapp_training'), newTraining);
      
      resetForm();
      setShowCreateModal(false);
      loadTrainings();
      alert('Treinamento criado com sucesso!');
    } catch (error) {
      console.error('Erro ao criar treinamento:', error);
      alert('Erro ao criar treinamento');
    }
  };

  const handleDelete = async (trainingId: string) => {
    if (!confirm('Deseja realmente excluir este treinamento? Esta ação não pode ser desfeita.')) return;

    try {
      await deleteDoc(doc(db, 'whatsapp_training', trainingId));
      loadTrainings();
      alert('Treinamento excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir treinamento:', error);
      alert('Erro ao excluir treinamento');
    }
  };

  const handleStartEdit = (training: WhatsAppTraining) => {
    console.log('🔧 Editando treinamento:', training);
    
    setEditingTrainingId(training.id);
    setTrainingName(training.name || '');
    setTrainingDescription(training.description || '');
    setTrainingType(training.type);
    setTitle(training.title);
    setContent(training.content || '');
    setMode(training.mode || 'keywords');
    setKeywords(training.keywords || []);
    setKeywordsMatchType(training.keywordsMatchType || 'any');
    setExitKeywords(training.exitKeywords || []);
    setExitMessage(training.exitMessage || '');
    setInactivityTimeout(training.inactivityTimeout || 0);
    setPriority(training.priority || 5);
    setIsActive(training.isActive !== undefined ? training.isActive : true);
    
    // Extrair dados específicos do tipo
    if (training.type === 'qna' && training.metadata) {
      setQuestion(training.metadata.question || '');
      setAnswer(training.metadata.answer || '');
    } else if (training.type === 'url' && training.metadata) {
      setUrl(training.metadata.url || '');
    }
    
    console.log('✅ Estados definidos:', {
      trainingName: training.name,
      title: training.title,
      mode: training.mode,
      keywords: training.keywords,
      priority: training.priority
    });
    
    setShowEditModal(true);
  };

  const handleUpdateTraining = async () => {
    if (!user || !selectedConnectionId || !title.trim() || !trainingName.trim() || !editingTrainingId) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    if (mode === 'keywords' && keywords.length === 0) {
      alert('Adicione pelo menos uma palavra-chave para o modo "Palavras-chave"');
      return;
    }

    try {
      let trainingContent = '';
      let metadata = {};

      switch (trainingType) {
        case 'prompt':
          trainingContent = content;
          break;
        case 'qna':
          trainingContent = `Q: ${question}\nA: ${answer}`;
          metadata = { question, answer };
          break;
        case 'url':
          trainingContent = `URL: ${url}`;
          metadata = { url };
          break;
        case 'document':
          trainingContent = content;
          break;
      }

      const updatedTraining = {
        name: trainingName,
        description: trainingDescription,
        type: trainingType,
        title,
        content: trainingContent,
        metadata,
        mode,
        keywords,
        keywordsMatchType,
        exitKeywords,
        exitMessage,
        inactivityTimeout,
        priority,
        isActive,
        updatedAt: Timestamp.now(),
      };

      await updateDoc(doc(db, 'whatsapp_training', editingTrainingId), updatedTraining);
      
      resetForm();
      setShowEditModal(false);
      setEditingTrainingId(null);
      loadTrainings();
      alert('Treinamento atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar treinamento:', error);
      alert('Erro ao atualizar treinamento');
    }
  };

  const handleCancelEdit = () => {
    resetForm();
    setShowEditModal(false);
    setEditingTrainingId(null);
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setUrl('');
    setQuestion('');
    setAnswer('');
    setTrainingName('');
    setTrainingDescription('');
    setMode('keywords');
    setKeywords([]);
    setKeywordInput('');
    setKeywordsMatchType('any');
    setExitKeywords([]);
    setExitKeywordInput('');
    setExitMessage('');
    setInactivityTimeout(0);
    setPriority(5);
    setIsActive(true);
    setEditingTrainingId(null);
  };

  const handleAddKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim().toLowerCase())) {
      setKeywords([...keywords, keywordInput.trim().toLowerCase()]);
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };

  const handleAddExitKeyword = () => {
    if (exitKeywordInput.trim() && !exitKeywords.includes(exitKeywordInput.trim().toLowerCase())) {
      setExitKeywords([...exitKeywords, exitKeywordInput.trim().toLowerCase()]);
      setExitKeywordInput('');
    }
  };

  const handleRemoveExitKeyword = (keyword: string) => {
    setExitKeywords(exitKeywords.filter(k => k !== keyword));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = trainings.findIndex(t => t.id === active.id);
    const newIndex = trainings.findIndex(t => t.id === over.id);

    // Reordenar array localmente
    const newTrainings = arrayMove(trainings, oldIndex, newIndex);
    setTrainings(newTrainings);

    // Atualizar prioridades no Firestore
    try {
      const updatePromises = newTrainings.map((training, index) => {
        const newPriority = (newTrainings.length - index) * 10;
        return updateDoc(doc(db, 'whatsapp_training', training.id), {
          priority: newPriority
        });
      });

      await Promise.all(updatePromises);
      console.log('✅ Prioridades reorganizadas com sucesso');
    } catch (error) {
      console.error('Erro ao reorganizar prioridades:', error);
      // Reverter mudança local em caso de erro
      loadTrainings();
    }
  };

  const getTypeInfo = (type: TrainingType) => {
    switch (type) {
      case 'document':
        return { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Documento' };
      case 'qna':
        return { icon: MessageSquare, color: 'text-green-600', bg: 'bg-green-50', label: 'Pergunta & Resposta' };
      case 'prompt':
        return { icon: BookOpen, color: 'text-purple-600', bg: 'bg-purple-50', label: 'Prompt' };
      case 'url':
        return { icon: LinkIcon, color: 'text-orange-600', bg: 'bg-orange-50', label: 'URL' };
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
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma conexão encontrada</h3>
          <p className="text-gray-600 mb-6">Crie uma conexão do WhatsApp primeiro para começar o treinamento</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Treinamento da IA</h1>
          <p className="text-gray-600 mt-1">Ensine sua IA com documentos, prompts e mais</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Novo Treinamento
        </button>
      </div>

      {/* Connection Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecione a Conexão
        </label>
        <select
          value={selectedConnectionId}
          onChange={(e) => setSelectedConnectionId(e.target.value)}
          className="w-full max-w-md px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        >
          {connections.map((conn) => (
            <option key={conn.id} value={conn.id}>
              {conn.name} {conn.phoneNumber ? `(${conn.phoneNumber})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total</p>
              <p className="text-2xl font-bold text-gray-900">{trainings.length}</p>
            </div>
            <BookOpen className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Prompts</p>
              <p className="text-2xl font-bold text-purple-600">
                {trainings.filter(t => t.type === 'prompt').length}
              </p>
            </div>
            <BookOpen className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Q&A</p>
              <p className="text-2xl font-bold text-green-600">
                {trainings.filter(t => t.type === 'qna').length}
              </p>
            </div>
            <MessageSquare className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Documentos</p>
              <p className="text-2xl font-bold text-blue-600">
                {trainings.filter(t => t.type === 'document').length}
              </p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Training List */}
      {trainings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum treinamento criado</h3>
          <p className="text-gray-600 mb-6">Comece adicionando informações para treinar sua IA</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Novo Treinamento
          </button>
        </div>
      ) : (
        <div>
          {/* Drag & Drop Instructions */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 <strong>Dica:</strong> Arraste os cards para reorganizar as prioridades. A posição #1 tem maior prioridade.
            </p>
          </div>

          {/* Sortable Training Cards */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={trainings.map(t => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {trainings.map((training, index) => (
                  <SortableTrainingCard
                    key={training.id}
                    training={training}
                    position={index + 1}
                    onEdit={handleStartEdit}
                    onDelete={handleDelete}
                    getTypeInfo={getTypeInfo}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Novo Treinamento</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* NOVO: Configuração do Treinamento */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">⚙️ Configuração da IA</h3>
              
              <div className="space-y-4">
                {/* Nome do Treinamento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Treinamento *
                  </label>
                  <input
                    type="text"
                    value={trainingName}
                    onChange={(e) => setTrainingName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Ex: Atendimento Vendas"
                  />
                  <p className="text-xs text-gray-500 mt-1">Nome único para identificar este treinamento</p>
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição (opcional)
                  </label>
                  <input
                    type="text"
                    value={trainingDescription}
                    onChange={(e) => setTrainingDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Ex: IA especializada em perguntas sobre vendas e preços"
                  />
                </div>

                {/* Modo de Ativação */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Modo de Ativação *
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="always"
                        checked={mode === 'always'}
                        onChange={(e) => setMode(e.target.value as 'always' | 'keywords')}
                        className="w-4 h-4 text-orange-600"
                      />
                      <span className="text-sm text-gray-700">
                        <strong>Sempre Ativo</strong> - IA responde todas as mensagens
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="keywords"
                        checked={mode === 'keywords'}
                        onChange={(e) => setMode(e.target.value as 'always' | 'keywords')}
                        className="w-4 h-4 text-orange-600"
                      />
                      <span className="text-sm text-gray-700">
                        <strong>Palavras-chave</strong> - IA responde apenas mensagens com palavras específicas
                      </span>
                    </label>
                  </div>
                </div>

                {/* Palavras-chave (se modo keywords) */}
                {mode === 'keywords' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Palavras-chave *
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={keywordInput}
                          onChange={(e) => setKeywordInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="Digite uma palavra-chave"
                        />
                        <button
                          type="button"
                          onClick={handleAddKeyword}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {keywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm"
                          >
                            {keyword}
                            <button
                              type="button"
                              onClick={() => handleRemoveKeyword(keyword)}
                              className="hover:text-orange-900"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      {keywords.length === 0 && (
                        <p className="text-xs text-red-600 mt-1">Adicione pelo menos uma palavra-chave</p>
                      )}
                    </div>

                    {/* Tipo de Match */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo de Correspondência
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            value="any"
                            checked={keywordsMatchType === 'any'}
                            onChange={(e) => setKeywordsMatchType(e.target.value as 'any' | 'all')}
                            className="w-4 h-4 text-orange-600"
                          />
                          <span className="text-sm text-gray-700">
                            <strong>Qualquer palavra</strong> - Ativa se a mensagem contiver QUALQUER palavra-chave
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            value="all"
                            checked={keywordsMatchType === 'all'}
                            onChange={(e) => setKeywordsMatchType(e.target.value as 'any' | 'all')}
                            className="w-4 h-4 text-orange-600"
                          />
                          <span className="text-sm text-gray-700">
                            <strong>Todas as palavras</strong> - Ativa apenas se a mensagem contiver TODAS as palavras-chave
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Exit Keywords - Palavras de Saída */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Palavras de Saída (opcional)
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        Palavras que finalizam o treinamento para aquela conversa (ex: tchau, obrigado, sair)
                      </p>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={exitKeywordInput}
                          onChange={(e) => setExitKeywordInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddExitKeyword())}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="Digite uma palavra de saída"
                        />
                        <button
                          type="button"
                          onClick={handleAddExitKeyword}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {exitKeywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                          >
                            {keyword}
                            <button
                              type="button"
                              onClick={() => handleRemoveExitKeyword(keyword)}
                              className="hover:text-red-900"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Mensagem de Despedida */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mensagem de Despedida (opcional)
                      </label>
                      <textarea
                        value={exitMessage}
                        onChange={(e) => setExitMessage(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="Mensagem enviada quando o treinamento é finalizado (ex: Obrigado pelo contato!)"
                      />
                    </div>

                    {/* Timeout de Inatividade */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Timeout de Inatividade (opcional)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={inactivityTimeout || ''}
                          onChange={(e) => setInactivityTimeout(Number(e.target.value) || 0)}
                          className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="0"
                        />
                        <span className="text-sm text-gray-600">minutos</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Tempo sem mensagens para desativar automaticamente. Use 0 para nunca expirar. 
                        <strong>Exemplo:</strong> 60 = 1 hora, 1440 = 1 dia
                      </p>
                    </div>
                  </>
                )}

                {/* Prioridade */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prioridade
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value) || 1)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Ex: 10"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Valores maiores = maior prioridade. Use 100+ para treinamentos críticos. Reorganize arrastando os cards.
                  </p>
                </div>

                {/* Status */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 text-orange-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Treinamento Ativo
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 ml-6">Se desmarcado, este treinamento será ignorado pela IA</p>
                </div>
              </div>
            </div>

            {/* Type Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Tipo de Treinamento
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['prompt', 'qna', 'document', 'url'] as TrainingType[]).map((type) => {
                  const info = getTypeInfo(type);
                  const Icon = info.icon;
                  return (
                    <button
                      key={type}
                      onClick={() => setTrainingType(type)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                        trainingType === type
                          ? `border-orange-600 ${info.bg}`
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${trainingType === type ? info.color : 'text-gray-600'}`} />
                      <span className="text-xs font-medium text-gray-700">{info.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Título *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Ex: Informações sobre produtos"
                />
              </div>

              {trainingType === 'prompt' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Conteúdo do Prompt *
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={8}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Digite o prompt que a IA deve seguir..."
                  />
                </div>
              )}

              {trainingType === 'qna' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pergunta *
                    </label>
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Ex: Qual o horário de funcionamento?"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Resposta *
                    </label>
                    <textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Digite a resposta que a IA deve dar..."
                    />
                  </div>
                </>
              )}

              {trainingType === 'url' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL *
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="https://exemplo.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    A IA irá extrair o conteúdo desta URL automaticamente
                  </p>
                </div>
              )}

              {trainingType === 'document' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Conteúdo do Documento *
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={8}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Cole o conteúdo do documento aqui..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Em breve: upload de arquivos PDF, DOCX, TXT
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateTraining}
                disabled={!title.trim() || 
                  (trainingType === 'prompt' && !content.trim()) ||
                  (trainingType === 'qna' && (!question.trim() || !answer.trim())) ||
                  (trainingType === 'url' && !url.trim()) ||
                  (trainingType === 'document' && !content.trim())
                }
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Criar Treinamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingTrainingId && (
        <div key={editingTrainingId} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Editar Treinamento</h2>
              <button
                onClick={handleCancelEdit}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Usar o mesmo formulário do modal de criação */}
            {/* Configuração do Treinamento */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">⚙️ Configuração da IA</h3>
              
              <div className="space-y-4">
                {/* Nome do Treinamento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Treinamento *
                  </label>
                  <input
                    type="text"
                    value={trainingName}
                    onChange={(e) => setTrainingName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Ex: Atendimento Vendas"
                  />
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição (opcional)
                  </label>
                  <input
                    type="text"
                    value={trainingDescription}
                    onChange={(e) => setTrainingDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Ex: IA especializada em perguntas sobre vendas e preços"
                  />
                </div>

                {/* Modo de Ativação */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Modo de Ativação *
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="always"
                        checked={mode === 'always'}
                        onChange={(e) => setMode(e.target.value as 'always' | 'keywords')}
                        className="w-4 h-4 text-orange-600"
                      />
                      <span className="text-sm text-gray-700">
                        <strong>Sempre Ativo</strong> - IA responde todas as mensagens
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="keywords"
                        checked={mode === 'keywords'}
                        onChange={(e) => setMode(e.target.value as 'always' | 'keywords')}
                        className="w-4 h-4 text-orange-600"
                      />
                      <span className="text-sm text-gray-700">
                        <strong>Palavras-chave</strong> - IA responde apenas mensagens com palavras específicas
                      </span>
                    </label>
                  </div>
                </div>

                {/* Palavras-chave (se modo keywords) */}
                {mode === 'keywords' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Palavras-chave *
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={keywordInput}
                          onChange={(e) => setKeywordInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="Digite uma palavra-chave"
                        />
                        <button
                          type="button"
                          onClick={handleAddKeyword}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {keywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm"
                          >
                            {keyword}
                            <button
                              type="button"
                              onClick={() => handleRemoveKeyword(keyword)}
                              className="hover:text-orange-900"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Tipo de Match */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo de Correspondência
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            value="any"
                            checked={keywordsMatchType === 'any'}
                            onChange={(e) => setKeywordsMatchType(e.target.value as 'any' | 'all')}
                            className="w-4 h-4 text-orange-600"
                          />
                          <span className="text-sm text-gray-700">
                            <strong>Qualquer palavra</strong> - Ativa se a mensagem contiver QUALQUER palavra-chave
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            value="all"
                            checked={keywordsMatchType === 'all'}
                            onChange={(e) => setKeywordsMatchType(e.target.value as 'any' | 'all')}
                            className="w-4 h-4 text-orange-600"
                          />
                          <span className="text-sm text-gray-700">
                            <strong>Todas as palavras</strong> - Ativa apenas se a mensagem contiver TODAS as palavras-chave
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Exit Keywords - Palavras de Saída */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Palavras de Saída (opcional)
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        Palavras que finalizam o treinamento para aquela conversa (ex: tchau, obrigado, sair)
                      </p>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={exitKeywordInput}
                          onChange={(e) => setExitKeywordInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddExitKeyword())}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="Digite uma palavra de saída"
                        />
                        <button
                          type="button"
                          onClick={handleAddExitKeyword}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {exitKeywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                          >
                            {keyword}
                            <button
                              type="button"
                              onClick={() => handleRemoveExitKeyword(keyword)}
                              className="hover:text-red-900"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Mensagem de Despedida */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mensagem de Despedida (opcional)
                      </label>
                      <textarea
                        value={exitMessage}
                        onChange={(e) => setExitMessage(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="Mensagem enviada quando o treinamento é finalizado (ex: Obrigado pelo contato!)"
                      />
                    </div>

                    {/* Timeout de Inatividade */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Timeout de Inatividade (opcional)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={inactivityTimeout || ''}
                          onChange={(e) => setInactivityTimeout(Number(e.target.value) || 0)}
                          className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="0"
                        />
                        <span className="text-sm text-gray-600">minutos</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Tempo sem mensagens para desativar automaticamente. Use 0 para nunca expirar. 
                        <strong>Exemplo:</strong> 60 = 1 hora, 1440 = 1 dia
                      </p>
                    </div>
                  </>
                )}

                {/* Prioridade */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prioridade
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value) || 1)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Ex: 10"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Valores maiores = maior prioridade. Use 100+ para treinamentos críticos. Reorganize arrastando os cards.
                  </p>
                </div>

                {/* Status */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 text-orange-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Treinamento Ativo
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Tipo (desabilitado na edição) */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Tipo de Treinamento
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['prompt', 'qna', 'document', 'url'] as TrainingType[]).map((type) => {
                  const info = getTypeInfo(type);
                  const Icon = info.icon;
                  return (
                    <div
                      key={type}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 ${
                        trainingType === type
                          ? `border-orange-600 ${info.bg}`
                          : 'border-gray-300 opacity-50'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${trainingType === type ? info.color : 'text-gray-600'}`} />
                      <span className="text-xs font-medium text-gray-700">{info.label}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2">O tipo não pode ser alterado após a criação</p>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Título *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Ex: Informações sobre produtos"
                />
              </div>

              {trainingType === 'prompt' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Conteúdo do Prompt *
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={8}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Digite o prompt que a IA deve seguir..."
                  />
                </div>
              )}

              {trainingType === 'qna' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pergunta *
                    </label>
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Ex: Como funciona o pagamento?"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Resposta *
                    </label>
                    <textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Digite a resposta completa..."
                    />
                  </div>
                </>
              )}

              {trainingType === 'url' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL *
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="https://exemplo.com"
                  />
                </div>
              )}

              {trainingType === 'document' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Conteúdo do Documento *
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={12}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Cole o conteúdo do documento aqui..."
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCancelEdit}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateTraining}
                disabled={!title.trim()}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
