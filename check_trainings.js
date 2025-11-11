const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');

// Configuração do Firebase (usando as mesmas variáveis do projeto)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkTrainings() {
  console.log('🔍 Verificando treinamentos ativos...');

  try {
    const trainingRef = collection(db, 'whatsapp_training');
    const trainingQuery = query(
      trainingRef,
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(trainingQuery);

    if (snapshot.empty) {
      console.log('❌ Nenhum treinamento ativo encontrado');
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`📝 Treinamento: ${data.name}`);
      console.log(`   Modo: ${data.mode}`);
      console.log(`   Palavras-chave: ${data.keywords ? data.keywords.join(', ') : 'Nenhuma'}`);
      console.log(`   Tipo de match: ${data.keywordsMatchType || 'any'}`);
      console.log(`   Prioridade: ${data.priority || 1}`);
      console.log('---');
    });
  } catch (error) {
    console.error('Erro ao verificar treinamentos:', error);
  }

  process.exit(0);
}

checkTrainings().catch(console.error);