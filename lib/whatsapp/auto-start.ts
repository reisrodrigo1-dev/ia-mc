import { WhatsAppSessionManager } from './session-manager';
import { startKeepAlive, logConnectionStatus } from './keep-alive';

let isInitialized = false;

export async function initializeWhatsAppServer() {
  if (isInitialized) {
    console.log('⚠️ WhatsApp já inicializado');
    return;
  }

  console.log('🚀 Inicializando servidor WhatsApp...');
  
  try {
    // Restaurar sessões
    await WhatsAppSessionManager.restoreAllSessions();
    
    // Iniciar keep-alive
    startKeepAlive();
    
    // Iniciar logs de status
    logConnectionStatus();
    
    isInitialized = true;
    console.log('✅ Servidor WhatsApp inicializado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao inicializar WhatsApp:', error);
  }
}

// Auto-inicializar quando o módulo for carregado (apenas no servidor)
if (typeof window === 'undefined') {
  initializeWhatsAppServer();
}
