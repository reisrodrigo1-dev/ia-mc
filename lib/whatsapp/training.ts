import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export async function getTrainingData(connectionId: string) {
  try {
    const trainingRef = collection(db, 'whatsapp_training');
    const q = query(trainingRef, where('connectionId', '==', connectionId), where('isActive', '==', true));
    const docs = await getDocs(q);
    if (docs.empty) {
      return {};
    }
    // Return the first active training's data, or aggregate if multiple
    const training = docs.docs[0].data();
    return training;
  } catch (error) {
    console.error('Erro ao buscar treinamento:', error);
    return {};
  }
}