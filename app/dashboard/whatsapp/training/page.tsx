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
  Save
} from 'lucide-react';

type TrainingType = 'document' | 'qna' | 'prompt' | 'url';

export default function WhatsAppTrainingPage() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [trainings, setTrainings] = useState<WhatsAppTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [trainingType, setTrainingType] = useState<TrainingType>('prompt');
  
  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

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
        where('connectionId', '==', selectedConnectionId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const loadedTrainings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WhatsAppTraining[];

      setTrainings(loadedTrainings);
    } catch (error) {
      console.error('Erro ao carregar treinamentos:', error);
    }
  };

  const handleCreateTraining = async () => {
    if (!user || !selectedConnectionId || !title.trim()) return;

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
        type: trainingType,
        title,
        content: trainingContent,
        metadata,
        ownerId: user.uid || user.id,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'whatsapp_training'), newTraining);
      
      resetForm();
      setShowCreateModal(false);
      loadTrainings();
    } catch (error) {
      console.error('Erro ao criar treinamento:', error);
      alert('Erro ao criar treinamento');
    }
  };

  const handleDelete = async (trainingId: string) => {
    if (!confirm('Deseja realmente excluir este treinamento?')) return;

    try {
      await deleteDoc(doc(db, 'whatsapp_training', trainingId));
      loadTrainings();
    } catch (error) {
      console.error('Erro ao excluir treinamento:', error);
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setUrl('');
    setQuestion('');
    setAnswer('');
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trainings.map((training) => {
            const typeInfo = getTypeInfo(training.type);
            const TypeIcon = typeInfo.icon;
            
            return (
              <div key={training.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${typeInfo.bg}`}>
                    <TypeIcon className={`w-6 h-6 ${typeInfo.color}`} />
                  </div>
                  <button
                    onClick={() => handleDelete(training.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2">{training.title}</h3>
                
                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${typeInfo.bg} ${typeInfo.color} mb-3`}>
                  {typeInfo.label}
                </span>

                <div className="text-sm text-gray-600 line-clamp-3 mt-3 bg-gray-50 p-3 rounded-lg">
                  {training.content}
                </div>
              </div>
            );
          })}
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
    </div>
  );
}
