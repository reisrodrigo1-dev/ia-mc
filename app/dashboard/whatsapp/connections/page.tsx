'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
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
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { WhatsAppConnection } from '@/types';
import { 
  Phone, 
  Plus, 
  Trash2, 
  Eye, 
  Users, 
  User, 
  X,
  RefreshCw,
  Power,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';

type ConnectionStatus = 'disconnected' | 'connecting' | 'qr-code' | 'connected' | 'error';

export default function WhatsAppConnectionsPage() {
  const { user } = useAuth();
  const { isSuperAdmin, canManageSector } = usePermissions();
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<WhatsAppConnection | null>(null);
  
  // Form states
  const [newConnectionName, setNewConnectionName] = useState('');
  const [newConnectionPhone, setNewConnectionPhone] = useState('');
  const [newConnectionVisibility, setNewConnectionVisibility] = useState<'personal' | 'sector'>('personal');

  useEffect(() => {
    loadConnections();
  }, [user]);

  const loadConnections = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const connectionsRef = collection(db, 'whatsapp_connections');
      let q;
      
      // Super admin vê todas as conexões
      if (isSuperAdmin) {
        q = query(connectionsRef, orderBy('createdAt', 'desc'));
      } 
      // Usuário vê suas conexões pessoais + conexões do setor dele
      else {
        q = query(
          connectionsRef,
          where('ownerId', '==', user.uid || user.id),
          orderBy('createdAt', 'desc')
        );
        // TODO: Adicionar query para buscar também as do setor
      }

      const snapshot = await getDocs(q);
      const loadedConnections = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WhatsAppConnection[];

      setConnections(loadedConnections);
    } catch (error) {
      console.error('Erro ao carregar conexões:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConnection = async () => {
    if (!user || !newConnectionName.trim()) return;

    try {
      const newConnection: Omit<WhatsAppConnection, 'id'> = {
        name: newConnectionName,
        phoneNumber: newConnectionPhone || null,
        qrCode: null,
        status: 'connecting',
        visibility: newConnectionVisibility,
        ownerId: user.uid || user.id,
        ownerName: user.name || user.email || 'Usuário',
        sectorId: newConnectionVisibility === 'sector' ? user.sectorId : null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, 'whatsapp_connections'), newConnection);
      
      // Iniciar conexão real com WhatsApp via API
      const response = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: docRef.id }),
      });

      if (!response.ok) {
        throw new Error('Erro ao iniciar conexão com WhatsApp');
      }

      setNewConnectionName('');
      setNewConnectionPhone('');
      setNewConnectionVisibility('personal');
      setShowCreateModal(false);
      
      // Poll para aguardar QR Code
      const pollQrCode = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/whatsapp/connect?connectionId=${docRef.id}`);
          const statusData = await statusResponse.json();
          
          if (statusData.qrCode) {
            // Atualizar no Firestore
            await updateDoc(doc(db, 'whatsapp_connections', docRef.id), {
              qrCode: statusData.qrCode,
              status: statusData.status,
              updatedAt: Timestamp.now(),
            });
            
            setSelectedConnection({
              ...newConnection,
              id: docRef.id,
              qrCode: statusData.qrCode,
              status: statusData.status as any,
            });
            setShowQrModal(true);
            clearInterval(pollQrCode);
          } else if (statusData.status === 'connected') {
            // Já conectou
            await updateDoc(doc(db, 'whatsapp_connections', docRef.id), {
              status: 'connected',
              phoneNumber: statusData.phoneNumber,
              updatedAt: Timestamp.now(),
            });
            clearInterval(pollQrCode);
            loadConnections();
          }
        } catch (error) {
          console.error('Erro ao verificar QR Code:', error);
        }
      }, 1000); // Check a cada 1 segundo

      // Timeout de 60 segundos
      setTimeout(() => {
        clearInterval(pollQrCode);
      }, 60000);

      loadConnections();
    } catch (error) {
      console.error('Erro ao criar conexão:', error);
      alert('Erro ao criar conexão');
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm('Deseja realmente desconectar este WhatsApp?')) return;

    try {
      // Desconectar via API
      const response = await fetch(`/api/whatsapp/connect?connectionId=${connectionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao desconectar');
      }

      loadConnections();
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      alert('Erro ao desconectar');
    }
  };

  const handleDelete = async (connectionId: string) => {
    if (!confirm('Deseja realmente excluir esta conexão? Esta ação não pode ser desfeita.')) return;

    try {
      await deleteDoc(doc(db, 'whatsapp_connections', connectionId));
      loadConnections();
    } catch (error) {
      console.error('Erro ao excluir conexão:', error);
    }
  };

  const handleReconnect = async (connection: WhatsAppConnection) => {
    try {
      // Reconectar via API
      const response = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connection.id }),
      });

      if (!response.ok) {
        throw new Error('Erro ao reconectar');
      }

      // Poll para aguardar QR Code ou conexão
      const pollQrCode = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/whatsapp/connect?connectionId=${connection.id}`);
          const statusData = await statusResponse.json();
          
          console.log('Status da conexão:', statusData);
          
          if (statusData.qrCode) {
            // Tem QR Code para escanear
            await updateDoc(doc(db, 'whatsapp_connections', connection.id), {
              qrCode: statusData.qrCode,
              status: statusData.status,
              updatedAt: Timestamp.now(),
            });
            
            setSelectedConnection({
              ...connection,
              qrCode: statusData.qrCode,
              status: statusData.status as any,
            });
            setShowQrModal(true);
            clearInterval(pollQrCode);
          } else if (statusData.status === 'connected' || statusData.connected) {
            // Já está conectado!
            await updateDoc(doc(db, 'whatsapp_connections', connection.id), {
              status: 'connected',
              phoneNumber: statusData.phoneNumber,
              updatedAt: Timestamp.now(),
            });
            clearInterval(pollQrCode);
            loadConnections();
          }
        } catch (error) {
          console.error('Erro ao verificar QR Code:', error);
        }
      }, 1000);

      setTimeout(() => clearInterval(pollQrCode), 60000);

      loadConnections();
    } catch (error) {
      console.error('Erro ao reconectar:', error);
      alert('Erro ao reconectar');
    }
  };

  // Função para verificar status real de uma conexão
  const handleCheckStatus = async (connection: WhatsAppConnection) => {
    try {
      // Primeiro verificar o status atual
      const statusResponse = await fetch(`/api/whatsapp/connect?connectionId=${connection.id}`);
      const statusData = await statusResponse.json();
      
      console.log('Status verificado:', statusData);
      
      if (statusData.connected || statusData.status === 'connected') {
        // Atualizar Firestore com o status real
        await updateDoc(doc(db, 'whatsapp_connections', connection.id), {
          status: 'connected',
          phoneNumber: statusData.phoneNumber,
          updatedAt: Timestamp.now(),
        });
        loadConnections();
        alert('✅ Conexão está ativa! Status atualizado.');
      } else if (statusData.qrCode) {
        await updateDoc(doc(db, 'whatsapp_connections', connection.id), {
          qrCode: statusData.qrCode,
          status: statusData.status,
          updatedAt: Timestamp.now(),
        });
        loadConnections();
        alert('📱 QR Code disponível para escaneamento.');
      } else {
        // Status não está conectado - tentar restaurar da sessão salva
        const shouldRestore = confirm(
          '⚠️ Conexão não está ativa na memória do servidor.\n\n' +
          'Você tem uma sessão salva. Deseja restaurar automaticamente?\n\n' +
          '(Isso vai reconectar sem precisar escanear QR Code novamente)'
        );
        
        if (shouldRestore) {
          alert('🔄 Restaurando conexão... Aguarde alguns segundos e clique em "Verificar Status" novamente.');
          
          // Tentar restaurar via POST (que vai usar as credenciais salvas)
          const restoreResponse = await fetch('/api/whatsapp/connect', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              connectionId: connection.id,
            }),
          });

          if (restoreResponse.ok) {
            await updateDoc(doc(db, 'whatsapp_connections', connection.id), {
              status: 'connecting',
              updatedAt: Timestamp.now(),
            });
            loadConnections();
          } else {
            alert('❌ Erro ao restaurar. A sessão pode ter expirado. Tente reconectar.');
          }
        } else {
          alert(`Status: ${statusData.status || 'Desconectado'}`);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      alert('Erro ao verificar status');
    }
  };

  const getStatusInfo = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', text: 'Conectado' };
      case 'connecting':
      case 'qr-code':
        return { icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-50', text: 'Aguardando QR Code' };
      case 'disconnected':
        return { icon: Power, color: 'text-gray-600', bg: 'bg-gray-50', text: 'Desconectado' };
      case 'error':
        return { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', text: 'Erro' };
      default:
        return { icon: AlertCircle, color: 'text-gray-600', bg: 'bg-gray-50', text: 'Desconhecido' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Conexões WhatsApp</h1>
          <p className="text-gray-600 mt-1">Gerencie suas conexões do WhatsApp</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Nova Conexão
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total</p>
              <p className="text-2xl font-bold text-gray-900">{connections.length}</p>
            </div>
            <Phone className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Conectadas</p>
              <p className="text-2xl font-bold text-green-600">
                {connections.filter(c => c.status === 'connected').length}
              </p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Pessoais</p>
              <p className="text-2xl font-bold text-blue-600">
                {connections.filter(c => c.visibility === 'personal').length}
              </p>
            </div>
            <User className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Do Setor</p>
              <p className="text-2xl font-bold text-purple-600">
                {connections.filter(c => c.visibility === 'sector').length}
              </p>
            </div>
            <Users className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Connections List */}
      {connections.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Phone className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma conexão encontrada</h3>
          <p className="text-gray-600 mb-6">Crie sua primeira conexão do WhatsApp para começar</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nova Conexão
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {connections.map((connection) => {
            const statusInfo = getStatusInfo(connection.status);
            const StatusIcon = statusInfo.icon;
            
            return (
              <div key={connection.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{connection.name}</h3>
                    {connection.phoneNumber && (
                      <p className="text-sm text-gray-600">{connection.phoneNumber}</p>
                    )}
                  </div>
                  <div className={`p-2 rounded-lg ${statusInfo.bg}`}>
                    <StatusIcon className={`w-5 h-5 ${statusInfo.color} ${connection.status === 'connecting' ? 'animate-spin' : ''}`} />
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                    {statusInfo.text}
                  </span>
                  {connection.visibility === 'sector' ? (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-600 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Setor
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Pessoal
                    </span>
                  )}
                </div>

                <div className="text-xs text-gray-500 mb-4">
                  Criado por {connection.ownerName}
                </div>

                <div className="flex gap-2">
                  {connection.status === 'connected' ? (
                    <>
                      <button
                        onClick={() => handleCheckStatus(connection)}
                        className="flex-1 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Verificar Status
                      </button>
                      <button
                        onClick={() => handleDisconnect(connection.id)}
                        className="flex-1 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                      >
                        Desconectar
                      </button>
                    </>
                  ) : connection.status === 'qr-code' ? (
                    <button
                      onClick={() => {
                        setSelectedConnection(connection);
                        setShowQrModal(true);
                      }}
                      className="flex-1 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Ver QR Code
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleCheckStatus(connection)}
                        className="flex-1 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Verificar
                      </button>
                      <button
                        onClick={() => handleReconnect(connection)}
                        className="flex-1 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <Power className="w-4 h-4" />
                        Reconectar
                      </button>
                    </>
                  )}
                  
                  <button
                    onClick={() => handleDelete(connection.id)}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Nova Conexão</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Conexão *
                </label>
                <input
                  type="text"
                  value={newConnectionName}
                  onChange={(e) => setNewConnectionName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Ex: WhatsApp Suporte"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número (opcional)
                </label>
                <input
                  type="text"
                  value={newConnectionPhone}
                  onChange={(e) => setNewConnectionPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Ex: +55 11 98765-4321"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visibilidade
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setNewConnectionVisibility('personal')}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                      newConnectionVisibility === 'personal'
                        ? 'border-blue-600 bg-blue-50 text-blue-600'
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    Pessoal
                  </button>
                  <button
                    onClick={() => setNewConnectionVisibility('sector')}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                      newConnectionVisibility === 'sector'
                        ? 'border-purple-600 bg-purple-50 text-purple-600'
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Setor
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateConnection}
                disabled={!newConnectionName.trim()}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Criar Conexão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && selectedConnection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Escanear QR Code</h2>
              <button
                onClick={() => setShowQrModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center">
              <div className="bg-gray-50 p-8 rounded-xl mb-4">
                {selectedConnection.qrCode ? (
                  <img 
                    src={selectedConnection.qrCode} 
                    alt="QR Code" 
                    className="w-64 h-64 mx-auto"
                  />
                ) : (
                  <Loader2 className="w-16 h-16 text-orange-600 animate-spin mx-auto" />
                )}
              </div>

              <h3 className="font-semibold text-gray-900 mb-2">{selectedConnection.name}</h3>
              <p className="text-sm text-gray-600 mb-4">
                Abra o WhatsApp no seu celular e escaneie este QR Code para conectar
              </p>

              <ol className="text-left text-sm text-gray-600 space-y-2 mb-6 bg-blue-50 p-4 rounded-lg">
                <li>1. Abra o WhatsApp no seu celular</li>
                <li>2. Toque em <strong>Mais opções</strong> ou <strong>Configurações</strong></li>
                <li>3. Toque em <strong>Dispositivos conectados</strong></li>
                <li>4. Toque em <strong>Conectar um dispositivo</strong></li>
                <li>5. Aponte seu celular para esta tela para escanear o código</li>
              </ol>

              <button
                onClick={() => setShowQrModal(false)}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
