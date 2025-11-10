import { db } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  deleteField 
} from 'firebase/firestore';

interface ChatSession {
  connectionId: string;
  phoneNumber: string;
  activeTrainingId: string | null;
  trainingStartedAt: string | null;
  lastMessageAt: string;
  messageCount: number;
}

/**
 * Obtém ou cria uma sessão de chat individual
 */
export async function getChatSession(connectionId: string, phoneNumber: string): Promise<ChatSession> {
  try {
    const chatId = `${connectionId}_${phoneNumber.replace(/[^0-9]/g, '')}`;
    const chatRef = doc(db, 'whatsapp_chats', chatId);
    const chatDoc = await getDoc(chatRef);

    if (chatDoc.exists()) {
      return chatDoc.data() as ChatSession;
    }

    // Criar nova sessão
    const newSession: ChatSession = {
      connectionId,
      phoneNumber,
      activeTrainingId: null,
      trainingStartedAt: null,
      lastMessageAt: new Date().toISOString(),
      messageCount: 0
    };

    await setDoc(chatRef, newSession);
    return newSession;
  } catch (error) {
    console.error('❌ Erro ao obter sessão de chat:', error);
    throw error;
  }
}

/**
 * Ativa um treinamento para uma conversa específica
 */
export async function activateTrainingForChat(
  connectionId: string, 
  phoneNumber: string, 
  trainingId: string
): Promise<void> {
  try {
    const chatId = `${connectionId}_${phoneNumber.replace(/[^0-9]/g, '')}`;
    const chatRef = doc(db, 'whatsapp_chats', chatId);

    await updateDoc(chatRef, {
      activeTrainingId: trainingId,
      trainingStartedAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString()
    });

    console.log(`✅ Treinamento ${trainingId} ativado para ${phoneNumber}`);
  } catch (error) {
    console.error('❌ Erro ao ativar treinamento:', error);
    throw error;
  }
}

/**
 * Desativa o treinamento de uma conversa específica
 */
export async function deactivateTrainingForChat(
  connectionId: string, 
  phoneNumber: string
): Promise<void> {
  try {
    const chatId = `${connectionId}_${phoneNumber.replace(/[^0-9]/g, '')}`;
    const chatRef = doc(db, 'whatsapp_chats', chatId);
    
    // Verificar se o documento existe
    const chatDoc = await getDoc(chatRef);
    
    if (!chatDoc.exists()) {
      console.log(`ℹ️ Nenhuma sessão de chat encontrada para ${phoneNumber} - nada para resetar`);
      return; // Não é um erro, apenas não há nada para fazer
    }

    // Verificar se realmente tem treinamento ativo
    const currentData = chatDoc.data();
    if (!currentData.activeTrainingId) {
      console.log(`ℹ️ Nenhum treinamento ativo para ${phoneNumber}`);
      return;
    }

    // Desativar treinamento
    await updateDoc(chatRef, {
      activeTrainingId: null,
      trainingStartedAt: null,
      lastMessageAt: new Date().toISOString()
    });

    console.log(`✅ Treinamento desativado para ${phoneNumber}`);
  } catch (error) {
    console.error('❌ Erro ao desativar treinamento:', error);
    throw error;
  }
}

/**
 * Incrementa contador de mensagens da conversa
 */
export async function incrementMessageCount(
  connectionId: string, 
  phoneNumber: string
): Promise<void> {
  try {
    const chatId = `${connectionId}_${phoneNumber.replace(/[^0-9]/g, '')}`;
    const chatRef = doc(db, 'whatsapp_chats', chatId);
    const chatDoc = await getDoc(chatRef);

    if (chatDoc.exists()) {
      const currentCount = chatDoc.data().messageCount || 0;
      await updateDoc(chatRef, {
        messageCount: currentCount + 1,
        lastMessageAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Erro ao incrementar contador:', error);
  }
}

/**
 * Busca treinamento ativo para uma conversa específica
 */
export async function getActiveTrainingForChat(
  connectionId: string, 
  phoneNumber: string
) {
  try {
    const session = await getChatSession(connectionId, phoneNumber);

    // Se não há treinamento ativo nesta conversa, retorna null
    if (!session.activeTrainingId) {
      return null;
    }

    // Buscar dados do treinamento
    const trainingRef = doc(db, 'whatsapp_training', session.activeTrainingId);
    const trainingDoc = await getDoc(trainingRef);

    if (!trainingDoc.exists()) {
      console.log(`⚠️ Treinamento ${session.activeTrainingId} não encontrado`);
      // Limpar referência inválida
      await deactivateTrainingForChat(connectionId, phoneNumber);
      return null;
    }

    const training = trainingDoc.data();

    // Verificar se ainda está ativo
    if (!training.isActive) {
      console.log(`⚠️ Treinamento ${session.activeTrainingId} não está mais ativo`);
      await deactivateTrainingForChat(connectionId, phoneNumber);
      return null;
    }

    return {
      id: trainingDoc.id,
      ...training,
      sessionStartedAt: session.trainingStartedAt,
      messageCount: session.messageCount
    } as any;
  } catch (error) {
    console.error('❌ Erro ao buscar treinamento ativo:', error);
    return null;
  }
}

/**
 * Busca todos os treinamentos disponíveis para iniciar (via keywords)
 */
export async function getAvailableTrainings(connectionId: string) {
  try {
    const trainingsRef = collection(db, 'whatsapp_training');
    const q = query(
      trainingsRef, 
      where('connectionId', '==', connectionId),
      where('isActive', '==', true),
      where('mode', '==', 'keywords')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];
  } catch (error) {
    console.error('❌ Erro ao buscar treinamentos disponíveis:', error);
    return [];
  }
}
