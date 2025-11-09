import { NextRequest, NextResponse } from 'next/server';
import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  fetchLatestBaileysVersion 
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
// @ts-ignore
import QRCode from 'qrcode';
import * as path from 'path';
import * as fs from 'fs';
import { 
  activeSessions, 
  pendingReconnections
} from '@/app/api/whatsapp/whatsapp-sessions';

// Função para restaurar sessões existentes
async function restoreExistingSessions() {
  const sessionsPath = path.join(process.cwd(), 'whatsapp_sessions');
  
  if (!fs.existsSync(sessionsPath)) {
    return;
  }

  const sessionDirs = fs.readdirSync(sessionsPath);
  
  for (const connectionId of sessionDirs) {
    const authPath = path.join(sessionsPath, connectionId);
    const credsPath = path.join(authPath, 'creds.json');
    
    // Verificar se tem credenciais salvas
    if (fs.existsSync(credsPath)) {
      console.log(`🔄 Restaurando sessão existente: ${connectionId}`);
      try {
        await createConnection(connectionId);
      } catch (error) {
        console.error(`❌ Erro ao restaurar ${connectionId}:`, error);
      }
    }
  }
}

// Restaurar sessões ao iniciar o servidor
restoreExistingSessions().then(() => {
  console.log('✅ Sessões restauradas com sucesso');
}).catch(err => {
  console.error('❌ Erro ao restaurar sessões:', err);
});

// Função auxiliar para criar conexão
async function createConnection(connectionId: string) {
  // Criar diretório para auth state
  const authPath = path.join(process.cwd(), 'whatsapp_sessions', connectionId);
  if (!fs.existsSync(authPath)) {
    fs.mkdirSync(authPath, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true, // Ver QR no terminal também
    // Configurações de reconexão
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: undefined,
    keepAliveIntervalMs: 10000,
    emitOwnEvents: true,
    fireInitQueries: true,
    // Logger personalizado para suprimir alguns logs
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

  activeSessions.set(connectionId, sock);

  // Event: Mensagens recebidas
  sock.ev.on('messages.upsert', async (m) => {
    try {
      const messages = m.messages;
      
      for (const message of messages) {
        // Ignorar mensagens antigas e de notificação
        if (!message.message || message.key.remoteJid === 'status@broadcast') {
          continue;
        }

        const isFromMe = message.key.fromMe;
        const chatJid = message.key.remoteJid!;
        const messageText = message.message?.conversation || 
                           message.message?.extendedTextMessage?.text || 
                           '[Mídia ou mensagem não suportada]';

        console.log(`\n📨 [${connectionId}] ========================================`);
        console.log(`📨 NOVA MENSAGEM RECEBIDA`);
        console.log(`👤 De: ${isFromMe ? 'Eu' : chatJid}`);
        console.log(`💬 Mensagem: ${messageText}`);
        console.log(`📨 ========================================\n`);

        // Extrair número do contato
        const contactNumber = chatJid.split('@')[0];

        // Salvar no Firestore dinamicamente
        const { initializeApp, getApps } = await import('firebase/app');
        const { getFirestore, collection, addDoc, query, where, getDocs, updateDoc, doc, Timestamp, setDoc, orderBy } = await import('firebase/firestore');

        // Inicializar Firebase se ainda não foi
        let firebaseApp;
        if (getApps().length === 0) {
          firebaseApp = initializeApp({
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
          });
        } else {
          firebaseApp = getApps()[0];
        }

        const db = getFirestore(firebaseApp);

        // Verificar se já existe um chat para este contato
        const chatsRef = collection(db, 'whatsapp_chats');
        const chatQuery = query(
          chatsRef,
          where('connectionId', '==', connectionId),
          where('contactNumber', '==', contactNumber)
        );
        
        const chatSnapshot = await getDocs(chatQuery);
        let chatId: string;
        let isAiActive = false;

        if (chatSnapshot.empty) {
          // Criar novo chat
          const newChat = {
            connectionId,
            contactNumber,
            contactName: message.pushName || contactNumber,
            lastMessage: messageText,
            lastMessageAt: Timestamp.now(),
            status: 'active',
            isAiActive: false,
            tags: [],
            notes: '',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };

          const chatDocRef = await addDoc(chatsRef, newChat);
          chatId = chatDocRef.id;
          isAiActive = false;
          console.log(`✅ [${connectionId}] Novo chat criado: ${chatId}`);
        } else {
          chatId = chatSnapshot.docs[0].id;
          isAiActive = chatSnapshot.docs[0].data().isAiActive || false;
          
          // Atualizar chat existente
          await updateDoc(doc(db, 'whatsapp_chats', chatId), {
            lastMessage: messageText,
            lastMessageAt: Timestamp.now(),
            contactName: message.pushName || chatSnapshot.docs[0].data().contactName,
            updatedAt: Timestamp.now(),
          });
          console.log(`✅ [${connectionId}] Chat atualizado: ${chatId}`);
        }

        // Salvar mensagem
        const newMessage = {
          connectionId,
          chatId,
          from: isFromMe ? 'me' : contactNumber,
          to: isFromMe ? contactNumber : 'me',
          message: messageText,
          isFromMe,
          timestamp: Timestamp.now(),
          status: 'delivered',
        };

        await addDoc(collection(db, 'whatsapp_messages'), newMessage);
        console.log(`✅ [${connectionId}] Mensagem salva no Firestore`);

        // Debug: verificar estado da IA
        console.log(`🔍 [${connectionId}] Debug IA - isFromMe: ${isFromMe}, isAiActive: ${isAiActive}, chatId: ${chatId}`);

        // 🤖 RESPOSTA AUTOMÁTICA DA IA (somente se IA estiver ativa e mensagem não for minha)
        if (!isFromMe && isAiActive) {
          console.log(`🤖 [${connectionId}] IA ativa! Processando resposta para chat ${chatId}...`);
          
          try {
            // Buscar treinamento da conexão
            const trainingRef = collection(db, 'whatsapp_training');
            const trainingQuery = query(
              trainingRef,
              where('connectionId', '==', connectionId)
            );
            const trainingSnapshot = await getDocs(trainingQuery);
            
            // Montar contexto com documentos de treinamento
            let contextText = '';
            trainingSnapshot.docs.forEach(doc => {
              const data = doc.data();
              contextText += `\n\n=== ${data.title} ===\n${data.content}`;
            });

            // Buscar últimas mensagens da conversa para contexto
            const messagesRef = collection(db, 'whatsapp_messages');
            const messagesQuery = query(
              messagesRef,
              where('chatId', '==', chatId),
              where('timestamp', '>', Timestamp.fromMillis(Date.now() - 3600000)), // últimas 1 hora
              orderBy('timestamp', 'asc')
            );
            const messagesSnapshot = await getDocs(messagesQuery);
            
            const conversationHistory: Array<{role: 'assistant' | 'user', content: string}> = messagesSnapshot.docs.map(doc => {
              const msg = doc.data();
              return {
                role: msg.isFromMe ? ('assistant' as const) : ('user' as const),
                content: msg.message
              };
            });

            // Chamar OpenAI
            const OpenAI = (await import('openai')).default;
            const openai = new OpenAI({
              apiKey: process.env.OPENAI_API_KEY,
            });

            const systemPrompt = `Você é um assistente inteligente de atendimento via WhatsApp. ${contextText ? 'Use as seguintes informações para responder:' + contextText : ''}

Regras:
- Seja profissional, cordial e objetivo
- Responda de forma clara e direta
- Use o contexto fornecido para dar respostas precisas
- Se não souber algo, seja honesto e ofereça ajuda`;

            const completion = await openai.chat.completions.create({
              model: 'gpt-4o', // Modelo mais recente com conhecimento atualizado
              messages: [
                { role: 'system', content: systemPrompt },
                ...conversationHistory.slice(-10), // últimas 10 mensagens
                { role: 'user', content: messageText }
              ],
              temperature: 0.7,
              max_tokens: 500,
            });

            const aiResponse = completion.choices[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';

            console.log(`🤖 [${connectionId}] Resposta da IA: ${aiResponse}`);

            // Enviar resposta via WhatsApp
            await sock.sendMessage(chatJid, { text: aiResponse });

            // Salvar resposta da IA no Firestore
            const aiMessage = {
              connectionId,
              chatId,
              from: 'me',
              to: contactNumber,
              message: aiResponse,
              isFromMe: true,
              timestamp: Timestamp.now(),
              status: 'sent',
            };

            await addDoc(collection(db, 'whatsapp_messages'), aiMessage);
            
            // Atualizar última mensagem do chat
            await updateDoc(doc(db, 'whatsapp_chats', chatId), {
              lastMessage: aiResponse,
              lastMessageAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            });

            console.log(`✅ [${connectionId}] Resposta da IA enviada e salva!`);

          } catch (aiError) {
            console.error(`❌ [${connectionId}] Erro ao processar IA:`, aiError);
          }
        }

      }
    } catch (error) {
      console.error(`❌ [${connectionId}] Erro ao processar mensagem:`, error);
    }
  });

  // Event: QR Code
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr, isNewLogin } = update;

    console.log(`📡 [${connectionId}] Update:`, {
      connection,
      hasQr: !!qr,
      hasDisconnect: !!lastDisconnect,
      isNewLogin
    });

    if (qr) {
      try {
        // Gerar QR Code em Base64
        const qrCodeDataUrl = await QRCode.toDataURL(qr);
        
        console.log(`✅ [${connectionId}] QR CODE GERADO! Escaneie com seu WhatsApp agora!`);
        console.log(`📱 Status: Aguardando escaneamento...`);
        
        // Retornar QR Code via endpoint GET
        activeSessions.set(`${connectionId}_qr`, qrCodeDataUrl);
        activeSessions.set(`${connectionId}_status`, 'qr-code');
      } catch (error) {
        console.error(`❌ [${connectionId}] Erro ao gerar QR Code:`, error);
      }
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== 401; // 401 = loggedOut
      
      console.log(`🔌 [${connectionId}] Conexão fechada.`);
      console.log(`📋 [${connectionId}] Status Code:`, statusCode);
      console.log(`🔄 [${connectionId}] Deve reconectar?`, shouldReconnect);
      
      // Mensagens amigáveis baseadas no erro
      if (statusCode === 428) {
        console.log(`⚠️ [${connectionId}] Sessão inválida - limpando e gerando novo QR...`);
      } else if (statusCode === 500) {
        console.log(`⚠️ [${connectionId}] Conexão fechada pelo servidor - reconectando...`);
      } else if (statusCode === 515) {
        console.log(`⚠️ [${connectionId}] Stream error - reconectando...`);
      } else if (statusCode === 401) {
        console.log(`🚪 [${connectionId}] Usuário deslogou - não vai reconectar`);
      } else {
        console.log(`⚠️ [${connectionId}] Erro ${statusCode || 'desconhecido'} - tentando reconectar...`);
      }
      
      activeSessions.set(`${connectionId}_status`, shouldReconnect ? 'disconnected' : 'error');
      activeSessions.delete(`${connectionId}_qr`);

      if (shouldReconnect) {
        // Reconectar automaticamente após 3 segundos
        console.log(`⏳ [${connectionId}] Aguardando 3s para reconectar...`);
        
        // Cancelar reconexão anterior se existir
        if (pendingReconnections.has(connectionId)) {
          clearTimeout(pendingReconnections.get(connectionId));
        }
        
        const timeout = setTimeout(() => {
          console.log(`🔄 [${connectionId}] Iniciando reconexão...`);
          createConnection(connectionId);
          pendingReconnections.delete(connectionId);
        }, 3000);
        
        pendingReconnections.set(connectionId, timeout);
      } else {
        console.log(`❌ [${connectionId}] Não vai reconectar - sessão encerrada`);
        activeSessions.delete(connectionId);
      }
    } else if (connection === 'open') {
      console.log(`\n🎉🎉🎉 [${connectionId}] ========================================`);
      console.log(`🎉 CONECTADO COM SUCESSO AO WHATSAPP!`);
      console.log(`📱 Número: ${sock.user?.id.split(':')[0]}`);
      console.log(`👤 Nome: ${sock.user?.name || 'N/A'}`);
      console.log(`🎉 ========================================\n`);
      
      activeSessions.set(`${connectionId}_status`, 'connected');
      activeSessions.set(`${connectionId}_phone`, sock.user?.id.split(':')[0] || null);
      activeSessions.set(`${connectionId}_user`, sock.user);
      activeSessions.delete(`${connectionId}_qr`);
      
      // Cancelar reconexão pendente se existir
      if (pendingReconnections.has(connectionId)) {
        clearTimeout(pendingReconnections.get(connectionId));
        pendingReconnections.delete(connectionId);
      }
    } else if (connection === 'connecting') {
      console.log(`🔄 [${connectionId}] Conectando ao WhatsApp...`);
      activeSessions.set(`${connectionId}_status`, 'connecting');
    }
  });

  // Salvar credenciais quando atualizadas
  sock.ev.on('creds.update', saveCreds);
}

// POST /api/whatsapp/connect - Iniciar nova conexão
export async function POST(request: NextRequest) {
  try {
    const { connectionId } = await request.json();

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId é obrigatório' }, { status: 400 });
    }

    console.log(`\n🚀 ========================================`);
    console.log(`🚀 INICIANDO CONEXÃO WHATSAPP`);
    console.log(`🚀 Connection ID: ${connectionId}`);
    console.log(`🚀 ========================================\n`);

    await createConnection(connectionId);

    return NextResponse.json({ 
      success: true, 
      message: 'Conexão iniciada. Aguarde o QR Code aparecer...' 
    });
  } catch (error: any) {
    console.error('❌ Erro ao iniciar conexão:', error);
    return NextResponse.json({ 
      error: 'Erro ao iniciar conexão', 
      details: error.message 
    }, { status: 500 });
  }
}

// DELETE /api/whatsapp/connect?connectionId=xxx - Desconectar
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId é obrigatório' }, { status: 400 });
    }

    const sock = activeSessions.get(connectionId);
    if (sock) {
      await sock.logout();
      activeSessions.delete(connectionId);
    }

    // Limpar dados da sessão
    activeSessions.delete(`${connectionId}_qr`);
    activeSessions.delete(`${connectionId}_status`);
    activeSessions.delete(`${connectionId}_phone`);

    // Limpar diretório de auth
    const authPath = path.join(process.cwd(), 'whatsapp_sessions', connectionId);
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
    }

    return NextResponse.json({ success: true, message: 'Desconectado com sucesso' });
  } catch (error: any) {
    console.error('Erro ao desconectar:', error);
    return NextResponse.json({ 
      error: 'Erro ao desconectar', 
      details: error.message 
    }, { status: 500 });
  }
}

// GET /api/whatsapp/connect?connectionId=xxx - Status e QR Code da conexão
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId é obrigatório' }, { status: 400 });
    }

    const sock = activeSessions.get(connectionId);
    const qrCode = activeSessions.get(`${connectionId}_qr`);
    const status = activeSessions.get(`${connectionId}_status`) || 'disconnected';
    const phoneNumber = activeSessions.get(`${connectionId}_phone`);
    const user = activeSessions.get(`${connectionId}_user`);
    const isConnected = sock && sock.user;

    console.log(`📊 [${connectionId}] Status check:`, {
      hasSocket: !!sock,
      hasQrCode: !!qrCode,
      status,
      isConnected: !!isConnected,
      phoneNumber: phoneNumber || 'N/A',
      hasUser: !!user
    });

    return NextResponse.json({ 
      connected: !!isConnected,
      status: isConnected ? 'connected' : status,
      qrCode: qrCode || null,
      phoneNumber: phoneNumber || null,
      user: user || (isConnected ? sock.user : null)
    });
  } catch (error: any) {
    console.error('❌ Erro ao verificar status:', error);
    return NextResponse.json({ 
      error: 'Erro ao verificar status', 
      details: error.message 
    }, { status: 500 });
  }
}
