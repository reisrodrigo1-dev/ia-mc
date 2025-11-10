import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export async function getTrainingData(connectionId: string) {
  try {
    const trainingRef = collection(db, 'whatsapp_training');
    const q = query(trainingRef, where('connectionId', '==', connectionId), where('isActive', '==', true));
    const docs = await getDocs(q);
    
    if (docs.empty) {
      console.log(`⚠️ Nenhum treinamento ativo encontrado para ${connectionId}`);
      return {};
    }
    
    if (docs.size > 1) {
      console.warn(`⚠️ ATENÇÃO: ${docs.size} treinamentos ativos encontrados para ${connectionId}! Usando o primeiro.`);
      docs.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`   Treinamento ${index + 1}: ${data.name} (modo: ${data.mode})`);
      });
    }
    
    // Return the first active training's data
    const training = docs.docs[0].data();
    console.log(`✅ Treinamento carregado: ${training.name} (ID: ${docs.docs[0].id})`);
    return training;
  } catch (error) {
    console.error('❌ Erro ao buscar treinamento:', error);
    return {};
  }
}