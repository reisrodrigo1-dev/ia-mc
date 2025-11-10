import { WhatsAppSessionManager } from './session-manager';

let keepAliveInterval: NodeJS.Timeout | null = null;

export function startKeepAlive() {
  if (keepAliveInterval) {
    console.log('⚠️ Keep-alive já está rodando');
    return;
  }

  console.log('🔄 Iniciando keep-alive para conexões WhatsApp...');

  // Ping a cada 5 minutos para evitar hibernação
  keepAliveInterval = setInterval(async () => {
    try {
      console.log('💓 Keep-alive ping...');
      
      // Verificar todas as conexões
      const connections = WhatsAppSessionManager.getAllConnections();
      
      for (const [connectionId, socket] of connections) {
        try {
          // Verificar se ainda está conectado
          if (socket.user) {
            console.log(`✅ ${connectionId} está ativo`);
          } else {
            console.log(`⚠️ ${connectionId} desconectado - tentando reconectar...`);
            await WhatsAppSessionManager.connectWhatsApp(connectionId);
          }
        } catch (error) {
          console.error(`❌ Erro ao verificar ${connectionId}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Erro no keep-alive:', error);
    }
  }, 5 * 60 * 1000); // 5 minutos

  console.log('✅ Keep-alive iniciado');
}

export function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('🛑 Keep-alive parado');
  }
}

export function logConnectionStatus() {
  setInterval(() => {
    const connections = WhatsAppSessionManager.getAllConnections();
    console.log('📊 Status das conexões WhatsApp:');
    
    connections.forEach((socket, id) => {
      console.log(`  - ${id}: ${socket.user ? '✅ Conectado' : '❌ Desconectado'}`);
    });
  }, 60000); // A cada 1 minuto
}
