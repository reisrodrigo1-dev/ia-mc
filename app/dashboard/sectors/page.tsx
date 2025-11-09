'use client';

import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { Users, Plus, Shield, Building, UserCheck, Settings, Crown, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';

export default function SectorsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { canCreateSector } = usePermissions();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sectorName, setSectorName] = useState('');
  const [sectorDescription, setSectorDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!canCreateSector) {
      router.push('/dashboard');
    }
  }, [canCreateSector, router]);

  const handleCreateSector = async () => {
    if (!sectorName.trim()) {
      alert('Por favor, preencha o nome do setor');
      return;
    }

    if (!user) {
      alert('Você precisa estar autenticado para criar um setor');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('🏢 Criando setor no Firestore...');
      
      const sectorData = {
        name: sectorName,
        description: sectorDescription,
        createdBy: user.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        adminIds: [user.id], // Criador é admin por padrão
        memberIds: [user.id],
        isActive: true
      };

      const docRef = await addDoc(collection(db, 'sectors'), sectorData);
      
      console.log('✅ Setor criado com sucesso! ID:', docRef.id);
      alert(`Setor "${sectorName}" criado com sucesso!`);
      
      setShowCreateModal(false);
      setSectorName('');
      setSectorDescription('');
    } catch (error) {
      console.error('❌ Erro ao criar setor:', error);
      alert(`Erro ao criar setor: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!canCreateSector) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Setores</h1>
              <p className="text-gray-600 mt-1">
                Gerencie setores e organize sua equipe
              </p>
            </div>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:shadow-lg text-white px-6 py-4 rounded-xl transition-all font-semibold"
            >
              <Plus className="w-5 h-5" />
              Novo Setor
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Admin Banner */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-xl flex items-center justify-center">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-lg">Área de Super Admin</p>
              <p className="text-sm text-orange-100">
                Você tem permissões especiais para gerenciar setores
              </p>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Building className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">8</div>
                <div className="text-gray-600 text-sm">Setores Ativos</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">156</div>
                <div className="text-gray-600 text-sm">Usuários</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">42</div>
                <div className="text-gray-600 text-sm">Administradores</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">100%</div>
                <div className="text-gray-600 text-sm">Segurança</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sectors List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 text-center">
              <div className="w-20 h-20 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Users className="w-10 h-10 text-orange-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Nenhum setor criado ainda
              </h3>
              <p className="text-gray-600 mb-6">
                Crie setores para organizar usuários e compartilhar recursos
              </p>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:shadow-lg text-white px-8 py-4 rounded-xl transition-all font-semibold inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Criar Primeiro Setor
              </button>
            </div>
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
                  <span className="font-medium">Novo Setor</span>
                </button>
                <button className="w-full flex items-center gap-3 p-3 text-left text-gray-700 hover:bg-blue-50 rounded-lg transition-colors">
                  <UserCheck className="w-5 h-5 text-blue-500" />
                  <span className="font-medium">Gerenciar Usuários</span>
                </button>
                <button className="w-full flex items-center gap-3 p-3 text-left text-gray-700 hover:bg-green-50 rounded-lg transition-colors">
                  <Settings className="w-5 h-5 text-green-500" />
                  <span className="font-medium">Configurações</span>
                </button>
              </div>
            </div>

            {/* Permissions Info */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
              <h3 className="font-bold text-lg mb-4 text-gray-900">Sobre Setores</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                  <p>Controle de acesso granular por setor</p>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p>Compartilhamento de recursos entre membros</p>
                </div>
                <div className="flex items-start gap-3">
                  <Building className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                  <p>Organização hierárquica da equipe</p>
                </div>
              </div>
            </div>

            {/* Tip Card */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="w-5 h-5" />
                <h3 className="font-bold text-lg">Dica Administrativa</h3>
              </div>
              <p className="text-orange-50 text-sm leading-relaxed">
                Crie setores baseados em departamentos ou áreas de atuação para
                uma melhor organização da equipe.
              </p>
            </div>
          </div>
        </div>

        {/* Create Sector Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Criar Novo Setor</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Setor
                  </label>
                  <input
                    type="text"
                    value={sectorName}
                    onChange={(e) => setSectorName(e.target.value)}
                    placeholder="Ex: Departamento de Vendas"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={sectorDescription}
                    onChange={(e) => setSectorDescription(e.target.value)}
                    placeholder="Descreva as responsabilidades e objetivos deste setor..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateSector}
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Criando...' : 'Criar Setor'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
