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

    // Verificar se o socket está realmente funcional (tem user)
    if (!socket.user) {
      console.error('❌ Socket não tem user - conexão inválida');
      console.error('❌ Status atual:', status);
      return NextResponse.json(
        { error: `Conexão não está ativa. Status: ${status}. Socket existe mas não tem user.` },
        { status: 400 }
      );
    }

    console.log('✅ Socket válido encontrado, tentando enviar mensagem...');

    // Formatar número para o padrão do WhatsApp
    const formattedNumber = phoneNumber.includes('@s.whatsapp.net') 
      ? phoneNumber 
      : `${phoneNumber}@s.whatsapp.net`;

    console.log(`📤 Enviando mensagem para ${formattedNumber}`);

    try {
      // Enviar mensagem via Baileys
      await socket.sendMessage(formattedNumber, { text: message });
      console.log(`✅ Mensagem enviada com sucesso para ${formattedNumber}`);
    } catch (sendError: any) {
      console.error('❌ Erro ao enviar mensagem via socket:', sendError);
      
      // Se o erro indica que a conexão caiu, tentar atualizar o status
      if (sendError.message?.includes('not connected') || 
          sendError.message?.includes('connection closed') ||
          sendError.message?.includes('timeout')) {
        
        console.log('🔄 Conexão parece ter caído, atualizando status...');
        
        // Importar funções de gerenciamento de sessão
        const { setActiveSession } = await import('@/app/api/whatsapp/whatsapp-sessions');
        
        // Marcar como desconectado
        setActiveSession(`${connectionId}_status`, 'disconnected');
        
        return NextResponse.json(
          { error: 'Conexão caiu durante o envio. Tente novamente ou reconecte o WhatsApp.' },
          { status: 400 }
        );
      }
      
      // Re-throw para o catch geral
      throw sendError;
    }

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
