import { NextRequest, NextResponse } from 'next/server';
import { getActiveSession, getSessionStatus } from '@/app/api/whatsapp/whatsapp-sessions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, phoneNumber, message } = body;

    console.log('📤 Recebido pedido para enviar mensagem:', { connectionId, phoneNumber, message });

    if (!connectionId || !phoneNumber || !message) {
      console.error('❌ Dados faltando:', { connectionId, phoneNumber, hasMessage: !!message });
      return NextResponse.json(
        { error: 'connectionId, phoneNumber e message são obrigatórios' },
        { status: 400 }
      );
    }

    // Obter socket da sessão ativa
    const socket = getActiveSession(connectionId);
    const status = getSessionStatus(connectionId);

    console.log('🔍 Verificando sessão:', { 
      hasSocket: !!socket, 
      status,
      connectionId
    });

    if (!socket) {
      console.error('❌ Socket não encontrado para:', connectionId);
      return NextResponse.json(
        { error: 'Conexão não encontrada ou não está ativa' },
        { status: 404 }
      );
    }

    if (status !== 'connected') {
      console.error('❌ Status não é "connected":', status);
      console.error('❌ Socket user:', socket.user);
      console.error('❌ Socket authState:', socket.authState);
      return NextResponse.json(
        { error: `Conexão não está ativa. Status: ${status}. Socket existe: ${!!socket}, User: ${socket.user ? 'Sim' : 'Não'}` },
        { status: 400 }
      );
    }

    // Formatar número para o padrão do WhatsApp
    const formattedNumber = phoneNumber.includes('@s.whatsapp.net') 
      ? phoneNumber 
      : `${phoneNumber}@s.whatsapp.net`;

    console.log(`📤 Enviando mensagem para ${formattedNumber}`);

    // Enviar mensagem via Baileys
    await socket.sendMessage(formattedNumber, { text: message });

    console.log(`✅ Mensagem enviada com sucesso para ${formattedNumber}`);

    return NextResponse.json({
      success: true,
      message: 'Mensagem enviada com sucesso'
    });

  } catch (error: any) {
    console.error('❌ Erro ao enviar mensagem:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao enviar mensagem', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
