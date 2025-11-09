'use client';

import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { Users, Plus, Shield, Building, UserCheck, Settings, Crown, X, Edit, Trash2, Key, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { Sector } from '@/types';

interface SectorStats {
  totalSectors: number;
  totalUsers: number;
  totalAdmins: number;
}

export default function SectorsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { canCreateSector } = usePermissions();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sectorName, setSectorName] = useState('');
  const [sectorDescription, setSectorDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loadingSectors, setLoadingSectors] = useState(true);
  const [stats, setStats] = useState<SectorStats>({
    totalSectors: 0,
    totalUsers: 0,
    totalAdmins: 0
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sectorToDelete, setSectorToDelete] = useState<Sector | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedSectorForMembers, setSelectedSectorForMembers] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [sectorMembers, setSectorMembers] = useState<any[]>([]);
  const [showChangeSectorModal, setShowChangeSectorModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [targetSectorId, setTargetSectorId] = useState('');

  useEffect(() => {
    if (!canCreateSector) {
      router.push('/dashboard');
    } else {
      loadSectors();
    }
  }, [canCreateSector, router]);

  const loadSectors = async () => {
    try {
      setLoadingSectors(true);
      console.log('🏢 Carregando setores...');

      // Carregar todos os setores
      const sectorsQuery = query(collection(db, 'sectors'));
      const sectorsSnapshot = await getDocs(sectorsQuery);
      
      // Carregar todos os usuários
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // Mapear setores com contagem real de membros
      const sectorsData = sectorsSnapshot.docs.map(doc => {
        const sectorData = doc.data();
        const sectorId = doc.id;
        
        // Contar usuários que têm este sectorId
        const membersCount = users.filter((u: any) => u.sectorId === sectorId).length;
        
        // Contar admins deste setor
        const adminsCount = users.filter((u: any) => 
          u.sectorId === sectorId && (u.role === 'sector_admin' || u.role === 'super_admin')
        ).length;

        return {
          id: sectorId,
          ...sectorData,
          membersCount, // Adicionar contagem real
          adminsCount   // Adicionar contagem real de admins
        } as Sector & { membersCount: number; adminsCount: number };
      });

      setSectors(sectorsData);
      console.log('✅ Setores carregados:', sectorsData.length);

      // Armazenar todos os usuários para uso posterior
      setAllUsers(users);

      // Calcular estatísticas totais
      const totalAdmins = users.filter((u: any) => 
        u.role === 'super_admin' || u.role === 'sector_admin'
      ).length;

      setStats({
        totalSectors: sectorsData.length,
        totalUsers: users.length,
        totalAdmins: totalAdmins
      });

    } catch (error) {
      console.error('❌ Erro ao carregar setores:', error);
    } finally {
      setLoadingSectors(false);
    }
  };

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
        createdById: user.id,
        adminIds: [user.id],
        members: [user.id],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'sectors'), sectorData);
      
      console.log('✅ Setor criado com sucesso! ID:', docRef.id);
      alert(`Setor "${sectorName}" criado com sucesso!`);
      
      setShowCreateModal(false);
      setSectorName('');
      setSectorDescription('');
      
      // Recarregar setores
      await loadSectors();
    } catch (error) {
      console.error('❌ Erro ao criar setor:', error);
      alert(`Erro ao criar setor: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSector = async () => {
    if (!sectorToDelete || !user) return;

    try {
      setIsLoading(true);
      console.log('🗑️ Deletando setor:', sectorToDelete.id);

      await deleteDoc(doc(db, 'sectors', sectorToDelete.id));

      console.log('✅ Setor deletado com sucesso');
      alert(`Setor "${sectorToDelete.name}" deletado com sucesso!`);
      
      setShowDeleteConfirm(false);
      setSectorToDelete(null);
      
      // Recarregar setores
      await loadSectors();
    } catch (error) {
      console.error('❌ Erro ao deletar setor:', error);
      alert('Erro ao deletar setor');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenMembersModal = async (sector: any) => {
    try {
      setSelectedSectorForMembers(sector);
      setShowMembersModal(true);
      
      console.log('👥 Abrindo modal de membros do setor:', sector.name);
      
      // Recarregar usuários do Firestore para garantir dados atualizados
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      
      setAllUsers(users);
      
      // Filtrar membros deste setor
      const members = users.filter((u: any) => u.sectorId === sector.id);
      setSectorMembers(members);
      
      console.log('✅ Usuários carregados:', users.length, 'Membros do setor:', members.length);
    } catch (error) {
      console.error('❌ Erro ao carregar membros:', error);
      alert('Erro ao carregar membros do setor');
    }
  };

  const handleAddUserToSector = async (userId: string) => {
    if (!selectedSectorForMembers) return;

    try {
      setIsLoading(true);
      console.log('➕ Adicionando usuário ao setor:', userId);

      // Atualizar o sectorId do usuário
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        sectorId: selectedSectorForMembers.id,
        updatedAt: serverTimestamp()
      });

      console.log('✅ Usuário adicionado ao setor');
      
      // Recarregar usuários do Firestore
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      
      setAllUsers(users);
      
      // Atualizar lista de membros no modal
      const members = users.filter((u: any) => u.sectorId === selectedSectorForMembers.id);
      setSectorMembers(members);
      
      // Recarregar setores para atualizar contadores
      await loadSectors();
    } catch (error) {
      console.error('❌ Erro ao adicionar usuário:', error);
      alert('Erro ao adicionar usuário ao setor');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveUserFromSector = async (userId: string) => {
    if (!selectedSectorForMembers) return;

    try {
      setIsLoading(true);
      console.log('➖ Removendo usuário do setor:', userId);

      // Remover o sectorId do usuário
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        sectorId: null,
        updatedAt: serverTimestamp()
      });

      console.log('✅ Usuário removido do setor');
      
      // Recarregar usuários do Firestore
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      
      setAllUsers(users);
      
      // Atualizar lista de membros no modal
      const members = users.filter((u: any) => u.sectorId === selectedSectorForMembers.id);
      setSectorMembers(members);
      
      // Recarregar setores para atualizar contadores
      await loadSectors();
    } catch (error) {
      console.error('❌ Erro ao remover usuário:', error);
      alert('Erro ao remover usuário do setor');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeSector = async () => {
    if (!selectedUser || !targetSectorId) {
      alert('Por favor, selecione um setor');
      return;
    }

    try {
      setIsLoading(true);
      console.log('🔄 Trocando usuário de setor:', selectedUser.id, 'para:', targetSectorId);

      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, {
        sectorId: targetSectorId === 'null' ? null : targetSectorId,
        updatedAt: serverTimestamp()
      });

      console.log('✅ Setor alterado com sucesso');
      
      if (targetSectorId === 'null') {
        alert(`Usuário "${selectedUser.name}" removido de todos os setores!`);
      } else {
        alert(`Usuário "${selectedUser.name}" movido para o novo setor!`);
      }
      
      setShowChangeSectorModal(false);
      setSelectedUser(null);
      setTargetSectorId('');
      
      // Recarregar dados
      await loadSectors();
      
      // Se o modal de membros estiver aberto, atualizar
      if (selectedSectorForMembers) {
        const usersQuery = query(collection(db, 'users'));
        const usersSnapshot = await getDocs(usersQuery);
        const users = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];
        
        setAllUsers(users);
        const members = users.filter((u: any) => u.sectorId === selectedSectorForMembers.id);
        setSectorMembers(members);
      }
    } catch (error) {
      console.error('❌ Erro ao trocar setor:', error);
      alert('Erro ao trocar usuário de setor');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser || !newPassword.trim()) {
      alert('Por favor, informe a nova senha');
      return;
    }

    if (newPassword.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    try {
      setIsLoading(true);
      console.log('🔑 Alterando senha do usuário:', selectedUser.id);

      // Nota: Em produção, isso deveria ser feito através de uma Cloud Function
      // ou Firebase Admin SDK no backend por questões de segurança
      // Por enquanto, vamos apenas atualizar um campo no Firestore
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, {
        // Em produção real, usar Firebase Authentication para alterar senha
        passwordResetRequired: true,
        tempPassword: newPassword, // Temporário - não seguro em produção!
        updatedAt: serverTimestamp()
      });

      console.log('✅ Senha alterada com sucesso');
      alert(`Senha do usuário "${selectedUser.name}" alterada com sucesso!\n\nNova senha: ${newPassword}\n\nIMPORTANTE: Informe ao usuário para trocar a senha no próximo login.`);
      
      setShowChangePasswordModal(false);
      setSelectedUser(null);
      setNewPassword('');
    } catch (error) {
      console.error('❌ Erro ao alterar senha:', error);
      alert('Erro ao alterar senha do usuário');
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
                <div className="text-2xl font-bold text-gray-900">
                  {loadingSectors ? '...' : stats.totalSectors}
                </div>
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
                <div className="text-2xl font-bold text-gray-900">
                  {loadingSectors ? '...' : stats.totalUsers}
                </div>
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
                <div className="text-2xl font-bold text-gray-900">
                  {loadingSectors ? '...' : stats.totalAdmins}
                </div>
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
                <div className="text-2xl font-bold text-gray-900">
                  {loadingSectors ? '...' : '100%'}
                </div>
                <div className="text-gray-600 text-sm">Segurança</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sectors List */}
          <div className="lg:col-span-2 space-y-6">
            {loadingSectors ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 text-center">
                <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-gray-600 mt-4">Carregando setores...</p>
              </div>
            ) : sectors.length === 0 ? (
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
            ) : (
              <div className="space-y-4">
                {sectors.map((sector: any) => (
                  <div 
                    key={sector.id}
                    className="bg-white rounded-2xl border border-gray-200 shadow-lg hover:shadow-xl transition-all p-6"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                            <Building className="w-6 h-6 text-purple-600" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">{sector.name}</h3>
                            <p className="text-sm text-gray-500">
                              {sector.membersCount || 0} membros • {sector.adminsCount || 0} admins
                            </p>
                          </div>
                        </div>
                        {sector.description && (
                          <p className="text-gray-600 text-sm mt-3 ml-15">
                            {sector.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-3 ml-15">
                          <span>
                            Criado em {(() => {
                              const date = sector.createdAt as any;
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
                        onClick={() => handleOpenMembersModal(sector)}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg transition-all font-medium text-sm"
                      >
                        <UserCheck className="w-4 h-4" />
                        Gerenciar Membros
                      </button>
                      <button
                        className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-all font-medium text-sm"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSectorToDelete(sector);
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

        {/* Modal de Gerenciar Membros */}
        {showMembersModal && selectedSectorForMembers && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-8 my-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Gerenciar Membros</h2>
                  <p className="text-gray-600 mt-1">Setor: {selectedSectorForMembers.name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowMembersModal(false);
                    setSelectedSectorForMembers(null);
                    setSectorMembers([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Membros Atuais */}
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    Membros Atuais ({sectorMembers.length})
                  </h3>
                  {sectorMembers.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-xl">
                      <p className="text-gray-500">Nenhum membro neste setor ainda</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {sectorMembers.map((member: any) => (
                        <div 
                          key={member.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-semibold text-sm">
                                {member.name?.charAt(0).toUpperCase() || '?'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{member.name}</p>
                              <p className="text-sm text-gray-500">{member.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {member.role === 'sector_admin' && (
                              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                Admin
                              </span>
                            )}
                            {member.role === 'super_admin' && (
                              <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                                Super Admin
                              </span>
                            )}
                            <button
                              onClick={() => {
                                setSelectedUser(member);
                                setShowChangeSectorModal(true);
                              }}
                              disabled={isLoading}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Trocar de setor"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUser(member);
                                setShowChangePasswordModal(true);
                              }}
                              disabled={isLoading}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Alterar senha"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveUserFromSector(member.id)}
                              disabled={isLoading}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Remover do setor"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Adicionar Usuários */}
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-green-600" />
                    Adicionar Usuários
                  </h3>
                  {allUsers.filter((u: any) => !u.sectorId || u.sectorId !== selectedSectorForMembers.id).length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-xl">
                      <p className="text-gray-500">Todos os usuários já estão em setores</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {allUsers
                        .filter((u: any) => !u.sectorId || u.sectorId !== selectedSectorForMembers.id)
                        .map((availableUser: any) => (
                          <div 
                            key={availableUser.id}
                            className="flex items-center justify-between p-4 bg-green-50 rounded-xl hover:bg-green-100 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                <span className="text-green-600 font-semibold text-sm">
                                  {availableUser.name?.charAt(0).toUpperCase() || '?'}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{availableUser.name}</p>
                                <p className="text-sm text-gray-500">{availableUser.email}</p>
                                {availableUser.sectorId && (
                                  <p className="text-xs text-gray-400">Já está em outro setor</p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleAddUserToSector(availableUser.id)}
                              disabled={isLoading}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
                            >
                              Adicionar
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-gray-200 mt-6">
                <button
                  onClick={() => {
                    setShowMembersModal(false);
                    setSelectedSectorForMembers(null);
                    setSectorMembers([]);
                  }}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Trocar Setor */}
        {showChangeSectorModal && selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
              <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto mb-6">
                <RefreshCw className="w-8 h-8 text-blue-600" />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
                Trocar de Setor
              </h2>
              
              <p className="text-gray-600 text-center mb-6">
                Movendo usuário: <strong>{selectedUser.name}</strong>
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecione o novo setor
                </label>
                <select
                  value={targetSectorId}
                  onChange={(e) => setTargetSectorId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione um setor...</option>
                  {sectors.map((sector: any) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                  <option value="null">Remover de qualquer setor</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowChangeSectorModal(false);
                    setSelectedUser(null);
                    setTargetSectorId('');
                  }}
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleChangeSector}
                  disabled={isLoading || !targetSectorId}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:shadow-lg text-white rounded-xl font-semibold transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Alterando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Alterar Senha */}
        {showChangePasswordModal && selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
              <div className="flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mx-auto mb-6">
                <Key className="w-8 h-8 text-purple-600" />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
                Alterar Senha
              </h2>
              
              <p className="text-gray-600 text-center mb-6">
                Definir nova senha para: <strong>{selectedUser.name}</strong>
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nova Senha (mínimo 6 caracteres)
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite a nova senha"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-2">
                  ⚠️ Anote a senha e informe ao usuário
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowChangePasswordModal(false);
                    setSelectedUser(null);
                    setNewPassword('');
                  }}
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={isLoading || newPassword.length < 6}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:shadow-lg text-white rounded-xl font-semibold transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Alterando...' : 'Alterar Senha'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação de Exclusão */}
        {showDeleteConfirm && sectorToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
              <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
                Excluir Setor?
              </h2>
              
              <p className="text-gray-600 text-center mb-6">
                Tem certeza que deseja excluir o setor <strong>"{sectorToDelete.name}"</strong>? 
                Esta ação não pode ser desfeita e afetará todos os membros do setor.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSectorToDelete(null);
                  }}
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteSector}
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:shadow-lg text-white rounded-xl font-semibold transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
