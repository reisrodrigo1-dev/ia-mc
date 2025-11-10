import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket 
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';

interface SessionData {
  creds: any;
  keys: any;
}

export class WhatsAppSessionManager {
  private static sessions = new Map<string, any>();
  private static sockets = new Map<string, WASocket>();
  private static reconnectAttempts = new Map<string, number>();
  private static maxReconnectAttempts = 5;

  // Salvar sessão no Firestore
  static async saveSession(connectionId: string, authState: any) {
    try {
      const sessionData: SessionData = {
        creds: authState.state.creds,
        keys: authState.state.keys
      };

      await setDoc(doc(db, 'whatsapp_sessions', connectionId), {
        data: sessionData,
        updatedAt: new Date().toISOString()
      });

      console.log(`✅ Sessão salva no Firestore: ${connectionId}`);
    } catch (error) {
      console.error('❌ Erro ao salvar sessão:', error);
    }
  }

  // Carregar sessão do Firestore
  static async loadSession(connectionId: string): Promise<SessionData | null> {
    try {
      const sessionDoc = await getDoc(doc(db, 'whatsapp_sessions', connectionId));
      
      if (sessionDoc.exists()) {
        console.log(`✅ Sessão carregada do Firestore: ${connectionId}`);
        return sessionDoc.data().data as SessionData;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Erro ao carregar sessão:', error);
      return null;
    }
  }

  // Deletar sessão do Firestore
  static async deleteSession(connectionId: string) {
    try {
      await deleteDoc(doc(db, 'whatsapp_sessions', connectionId));
      this.sessions.delete(connectionId);
      this.sockets.delete(connectionId);
      this.reconnectAttempts.delete(connectionId);
      console.log(`✅ Sessão deletada: ${connectionId}`);
    } catch (error) {
      console.error('❌ Erro ao deletar sessão:', error);
    }
  }

  // Obter todas as conexões ativas
  static getAllConnections() {
    return this.sockets;
  }

  // Criar/Restaurar conexão WhatsApp
  static async connectWhatsApp(connectionId: string, onQR?: (qr: string) => void): Promise<WASocket> {
    try {
      const attempts = this.reconnectAttempts.get(connectionId) || 0;
      
      if (attempts >= this.maxReconnectAttempts) {
        console.log(`❌ ${connectionId} excedeu tentativas de reconexão (${attempts}/${this.maxReconnectAttempts})`);
        throw new Error('Máximo de tentativas de reconexão excedido');
      }

      console.log(`🔄 Iniciando conexão: ${connectionId} (tentativa ${attempts + 1}/${this.maxReconnectAttempts})`);
      
      // Tentar carregar sessão existente
      const savedSession = await this.loadSession(connectionId);
      
      // Criar pasta temporária para auth state
      const SESSION_DIR = path.join(process.cwd(), 'whatsapp_sessions', connectionId);
      if (!fs.existsSync(SESSION_DIR)) {
        fs.mkdirSync(SESSION_DIR, { recursive: true });
      }

      // Se tem sessão salva, restaurar arquivos
      if (savedSession) {
        console.log(`📦 Restaurando sessão salva: ${connectionId}`);
        const credsPath = path.join(SESSION_DIR, 'creds.json');
        fs.writeFileSync(credsPath, JSON.stringify(savedSession.creds));
      }

      const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
      const { version } = await fetchLatestBaileysVersion();

      const socket = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        logger: {
          level: 'silent' as any,
          fatal: () => {},
          error: () => {},
          warn: () => {},
          info: () => {},
          debug: () => {},
          trace: () => {},
          child: () => ({
            level: 'silent' as any,
            fatal: () => {},
            error: () => {},
            warn: () => {},
            info: () => {},
            debug: () => {},
            trace: () => {},
          } as any)
        } as any,
      });

      // Salvar socket na memória
      this.sockets.set(connectionId, socket);

      // Listener para QR Code e conexão
      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && onQR) {
          console.log(`📱 QR Code gerado: ${connectionId}`);
          onQR(qr);
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          
          console.log(`🔌 Conexão fechada: ${connectionId}, Status: ${statusCode}, Reconectar? ${shouldReconnect}`);

          if (shouldReconnect) {
            // Incrementar tentativas
            const currentAttempts = this.reconnectAttempts.get(connectionId) || 0;
            this.reconnectAttempts.set(connectionId, currentAttempts + 1);
            
            // Backoff exponencial: 2^tentativas segundos (máx 30s)
            const delay = Math.min(1000 * Math.pow(2, currentAttempts), 30000);
            console.log(`⏳ Aguardando ${delay}ms antes de reconectar...`);
            
            setTimeout(() => {
              console.log(`🔄 Reconectando: ${connectionId}`);
              this.connectWhatsApp(connectionId, onQR);
            }, delay);
          } else {
            // Logout - deletar sessão
            console.log(`🚪 Logout detectado: ${connectionId}`);
            await this.deleteSession(connectionId);
          }
        } else if (connection === 'open') {
          console.log(`✅ WhatsApp conectado: ${connectionId}`);
          console.log(`📱 Número: ${socket.user?.id.split(':')[0]}`);
          
          // Reset tentativas de reconexão
          this.reconnectAttempts.set(connectionId, 0);
          
          // Salvar sessão no Firestore
          await this.saveSession(connectionId, { state, saveCreds });
          
          // Atualizar status no Firestore
          await setDoc(doc(db, 'whatsapp_connections', connectionId), {
            status: 'connected',
            phoneNumber: socket.user?.id.split(':')[0] || null,
            userName: socket.user?.name || null,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      });

      // Salvar credenciais automaticamente quando atualizadas
      socket.ev.on('creds.update', async () => {
        await saveCreds();
        await this.saveSession(connectionId, { state, saveCreds });
      });

      // Listener para mensagens recebidas
      socket.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        
        if (!message.key.fromMe && message.message) {
          const from = message.key.remoteJid;
          const text = message.message.conversation || 
                      message.message.extendedTextMessage?.text || '';

          console.log(`� Nova mensagem de ${from}: ${text}`);

          // Chamar webhook para processar com IA
          try {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            await fetch(`${appUrl}/api/whatsapp/webhook`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                connectionId,
                from,
                message: text
              })
            });
          } catch (error) {
            console.error('❌ Erro ao processar mensagem:', error);
          }
        }
      });

      return socket;
    } catch (error) {
      console.error(`❌ Erro ao conectar WhatsApp (${connectionId}):`, error);
      throw error;
    }
  }

  // Restaurar todas as conexões na inicialização
  static async restoreAllSessions() {
    try {
      console.log('🔄 Restaurando sessões WhatsApp do Firestore...');
      
      // Buscar todas as conexões que estavam conectadas
      const connectionsRef = collection(db, 'whatsapp_connections');
      const q = query(connectionsRef, where('status', '==', 'connected'));
      const snapshot = await getDocs(q);

      console.log(`📊 Encontradas ${snapshot.size} conexões para restaurar`);

      for (const docSnap of snapshot.docs) {
        const connectionId = docSnap.id;
        console.log(`🔄 Restaurando conexão: ${connectionId}`);
        
        try {
          await this.connectWhatsApp(connectionId);
        } catch (error) {
          console.error(`❌ Erro ao restaurar ${connectionId}:`, error);
          
          // Marcar como desconectado se falhar
          await setDoc(doc(db, 'whatsapp_connections', connectionId), {
            status: 'disconnected',
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      }

      console.log('✅ Processo de restauração concluído');
    } catch (error) {
      console.error('❌ Erro ao restaurar sessões:', error);
    }
  }

  // Obter socket ativo
  static getSocket(connectionId: string): WASocket | undefined {
    return this.sockets.get(connectionId);
  }

  // Verificar se está conectado
  static isConnected(connectionId: string): boolean {
    const socket = this.sockets.get(connectionId);
    return socket?.user != null;
  }

  // Obter status da conexão
  static getStatus(connectionId: string): 'connected' | 'disconnected' | 'connecting' {
    const socket = this.sockets.get(connectionId);
    if (!socket) return 'disconnected';
    if (socket.user) return 'connected';
    return 'connecting';
  }

  // Desconectar manualmente
  static async disconnect(connectionId: string) {
    try {
      const socket = this.sockets.get(connectionId);
      if (socket) {
        await socket.logout();
      }
      await this.deleteSession(connectionId);
      
      // Atualizar status no Firestore
      await setDoc(doc(db, 'whatsapp_connections', connectionId), {
        status: 'disconnected',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      console.log(`✅ Desconectado: ${connectionId}`);
    } catch (error) {
      console.error(`❌ Erro ao desconectar ${connectionId}:`, error);
      throw error;
    }
  }
}
