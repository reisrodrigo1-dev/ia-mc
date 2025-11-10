import { NextRequest, NextResponse } from 'next/server';
import { WhatsAppSessionManager } from '@/lib/whatsapp/session-manager';
import { getTrainingData } from '@/lib/whatsapp/training';
import { 
  getChatSession, 
  getActiveTrainingForChat, 
  activateTrainingForChat,
  deactivateTrainingForChat,
  incrementMessageCount,
  getAvailableTrainings
} from '@/lib/whatsapp/chat-sessions';
import OpenAI from 'openai';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

export const runtime = 'nodejs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { connectionId, from, message } = await req.json();

    console.log('='.repeat(80));
    console.log(`📩 WEBHOOK - Nova mensagem recebida`);
    console.log(`📱 De: ${from}`);
    console.log(`💬 Mensagem: "${message}"`);
    console.log(`🔗 Connection ID: ${connectionId}`);

    // Normalizar número (remover @s.whatsapp.net)
    const phoneNumber = from.replace('@s.whatsapp.net', '');

    // Incrementar contador de mensagens
    await incrementMessageCount(connectionId, phoneNumber);

    // Buscar treinamento ativo para esta conversa específica
    let training = await getActiveTrainingForChat(connectionId, phoneNumber);

    console.log(`\n� VERIFICANDO TREINAMENTO ATIVO DA CONVERSA:`);
    
    if (training) {
      console.log(`✅ Treinamento encontrado: ${training.name} (ID: ${training.id})`);
      console.log(`   Iniciado em: ${training.sessionStartedAt}`);
      console.log(`   Mensagens na sessão: ${training.messageCount}`);
      
      // Verificar exit keywords
      if (training.exitKeywords && training.exitKeywords.length > 0) {
        const messageLower = message.toLowerCase().trim();
        const foundExitKeyword = training.exitKeywords.find((keyword: string) => 
          messageLower.includes(keyword.toLowerCase().trim())
        );

        if (foundExitKeyword) {
          console.log(`🚪 EXIT KEYWORD encontrada: "${foundExitKeyword}"`);
          console.log(`   Finalizando treinamento para esta conversa...`);
          
          await deactivateTrainingForChat(connectionId, phoneNumber);
          
          // Enviar mensagem de despedida se configurada
          if (training.exitMessage) {
            const socket = WhatsAppSessionManager.getSocket(connectionId);
            if (socket && WhatsAppSessionManager.isConnected(connectionId)) {
              await socket.sendMessage(from, { text: training.exitMessage });
              console.log(`👋 Mensagem de despedida enviada`);
            }
          }
          
          console.log('='.repeat(80));
          return NextResponse.json({ 
            success: true, 
            action: 'training_ended',
            message: 'Treinamento finalizado'
          });
        }
      }
    } else {
      console.log(`⚠️ Nenhum treinamento ativo para esta conversa`);
      console.log(`   Buscando treinamentos disponíveis por keyword...`);
      
      // Buscar treinamentos disponíveis (modo keywords)
      const availableTrainings = await getAvailableTrainings(connectionId);
      
      if (availableTrainings.length === 0) {
        console.log(`❌ Nenhum treinamento disponível`);
        console.log('='.repeat(80));
        return NextResponse.json({ success: false, reason: 'No available trainings' });
      }

      console.log(`📋 ${availableTrainings.length} treinamento(s) disponível(is)`);

      // Verificar qual treinamento deve ser ativado
      const messageLower = message.toLowerCase().trim().replace(/\s+/g, ' ');
      
      for (const availableTraining of availableTrainings) {
        const { keywords } = availableTraining;
        
        if (!keywords || keywords.length === 0) continue;

        const foundKeyword = keywords.find((keyword: string) =>
          messageLower.includes(keyword.toLowerCase().trim())
        );

        if (foundKeyword) {
          console.log(`🎯 Keyword encontrada: "${foundKeyword}"`);
          console.log(`   Ativando treinamento: ${availableTraining.name}`);
          
          // Ativar treinamento para esta conversa
          await activateTrainingForChat(connectionId, phoneNumber, availableTraining.id);
          training = await getActiveTrainingForChat(connectionId, phoneNumber);
          break;
        }
      }

      if (!training) {
        console.log(`❌ Nenhuma keyword correspondente encontrada`);
        console.log('='.repeat(80));
        return NextResponse.json({ success: false, reason: 'No keyword match' });
      }
    }

    console.log(`\n📋 TREINAMENTO ATIVO:`);
    console.log(`   Nome: ${training.name}`);
    console.log(`   Modo: ${training.mode}`);
    console.log(`   Exit Keywords: ${training.exitKeywords ? `[${training.exitKeywords.join(', ')}]` : 'Nenhuma'}`);
    console.log(`   Prompt: ${training.prompt?.substring(0, 100)}...`);

    console.log('\n✅ DECISÃO: VAI RESPONDER');
    console.log('-'.repeat(80));

    // Buscar histórico de mensagens recentes
    const messagesRef = collection(db, 'whatsapp_messages');
    const q = query(
      messagesRef,
      where('connectionId', '==', connectionId),
      where('from', '==', from),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const messagesSnapshot = await getDocs(q);
    
    // Construir contexto de conversa
    const conversationHistory = messagesSnapshot.docs
      .reverse()
      .map(doc => {
        const data = doc.data();
        return {
          role: data.fromMe ? 'assistant' : 'user',
          content: data.message
        };
      });

    // Gerar resposta com IA
    const systemPrompt = training.prompt || training.name || 'Você é um assistente útil.';
    
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    console.log(`🤖 Gerando resposta com IA para ${from}...`);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const reply = completion.choices[0].message.content;

    if (!reply) {
      console.log('⚠️ IA não gerou resposta');
      return NextResponse.json({ success: false, reason: 'No reply generated' });
    }

    console.log(`💬 Resposta gerada: ${reply.substring(0, 100)}...`);
    console.log('-'.repeat(80));

    // Salvar mensagem recebida no histórico
    await addDoc(collection(db, 'whatsapp_messages'), {
      connectionId,
      from,
      fromMe: false,
      message,
      timestamp: new Date().toISOString()
    });

    // Enviar resposta via WhatsApp
    const socket = WhatsAppSessionManager.getSocket(connectionId);
    if (socket && WhatsAppSessionManager.isConnected(connectionId)) {
      await socket.sendMessage(from, { text: reply });
      console.log(`✅ Resposta enviada para ${from}`);
      console.log('='.repeat(80));

      // Salvar resposta no histórico
      await addDoc(collection(db, 'whatsapp_messages'), {
        connectionId,
        from,
        fromMe: true,
        message: reply,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('❌ Socket não disponível ou desconectado');
      console.log('='.repeat(80));
      return NextResponse.json({ success: false, reason: 'Socket not available' }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      reply
    });

  } catch (error: any) {
    console.error('❌ Erro no webhook:', error);
    console.log('='.repeat(80));
    return NextResponse.json(
      { error: 'Erro ao processar mensagem', details: error.message },
      { status: 500 }
    );
  }
}
