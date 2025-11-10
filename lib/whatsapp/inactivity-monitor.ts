import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { deactivateTrainingForChat } from './chat-sessions';

let monitorInterval: NodeJS.Timeout | null = null;

/**
 * Inicia o monitor de inatividade
 * Verifica a cada 5 minutos se há chats inativos que devem ter o treinamento desativado
 */
export function startInactivityMonitor() {
  if (monitorInterval) {
    console.log('⚠️ Monitor de inatividade já está rodando');
    return;
  }

  console.log('🕐 Iniciando monitor de inatividade...');

  // Verificar a cada 5 minutos
  monitorInterval = setInterval(async () => {
    try {
      await checkInactiveChats();
    } catch (error) {
      console.error('❌ Erro no monitor de inatividade:', error);
    }
  }, 5 * 60 * 1000); // 5 minutos

  // Executar uma vez imediatamente
  checkInactiveChats().catch(error => {
    console.error('❌ Erro na verificação inicial de inatividade:', error);
  });

  console.log('✅ Monitor de inatividade iniciado (verifica a cada 5 minutos)');
}

/**
 * Para o monitor de inatividade
 */
export function stopInactivityMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('🛑 Monitor de inatividade parado');
  }
}

/**
 * Verifica todos os chats com treinamento ativo
 * e desativa os que ultrapassaram o tempo de inatividade
 */
async function checkInactiveChats() {
  console.log('🕐 Verificando chats inativos...');

  try {
    // Buscar todos os chats com treinamento ativo
    const chatsRef = collection(db, 'whatsapp_chats');
    const q = query(chatsRef, where('activeTrainingId', '!=', null));
    const chatsSnapshot = await getDocs(q);

    if (chatsSnapshot.empty) {
      console.log('ℹ️ Nenhum chat com treinamento ativo');
      return;
    }

    let checkedCount = 0;
    let deactivatedCount = 0;

    for (const chatDoc of chatsSnapshot.docs) {
      const chatData = chatDoc.data();
      const { connectionId, phoneNumber, activeTrainingId, lastMessageAt, trainingActivatedAt } = chatData;

      checkedCount++;

      if (!activeTrainingId) continue;

      // Buscar configurações do treinamento
      const trainingDoc = await getDoc(doc(db, 'whatsapp_training', activeTrainingId));
      
      if (!trainingDoc.exists()) {
        console.log(`⚠️ Treinamento ${activeTrainingId} não encontrado para chat ${phoneNumber}`);
        continue;
      }

      const training = trainingDoc.data();
      const timeoutMinutes = training.inactivityTimeout;

      // Se não tem timeout configurado ou é 0, pular
      if (!timeoutMinutes || timeoutMinutes <= 0) {
        continue;
      }

      // Calcular tempo desde a última mensagem
      const lastTime = lastMessageAt || trainingActivatedAt;
      if (!lastTime) {
        console.log(`⚠️ Chat ${phoneNumber} sem timestamp de última mensagem`);
        continue;
      }

      const lastMessageTime = new Date(lastTime).getTime();
      const now = Date.now();
      const inactiveMinutes = (now - lastMessageTime) / (1000 * 60);

      // Se ultrapassou o timeout, desativar
      if (inactiveMinutes >= timeoutMinutes) {
        console.log(`⏰ Chat ${phoneNumber} inativo há ${Math.round(inactiveMinutes)} minutos (timeout: ${timeoutMinutes}min)`);
        console.log(`   Treinamento: ${training.name}`);
        
        try {
          await deactivateTrainingForChat(connectionId, phoneNumber);
          deactivatedCount++;
          console.log(`✅ Treinamento desativado para ${phoneNumber} por inatividade`);
        } catch (error) {
          console.error(`❌ Erro ao desativar treinamento para ${phoneNumber}:`, error);
        }
      }
    }

    if (deactivatedCount > 0) {
      console.log(`🕐 ✅ Verificação concluída: ${checkedCount} chats verificados, ${deactivatedCount} desativados por inatividade`);
    } else {
      console.log(`🕐 ℹ️ Verificação concluída: ${checkedCount} chats verificados, nenhum inativo`);
    }
  } catch (error) {
    console.error('❌ Erro ao verificar chats inativos:', error);
  }
}
