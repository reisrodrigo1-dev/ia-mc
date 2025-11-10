import { NextRequest, NextResponse } from 'next/server';
import { getActiveTrainingForChat } from '@/lib/whatsapp/chat-sessions';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get('connectionId');
    const phoneNumber = searchParams.get('phoneNumber');

    if (!connectionId || !phoneNumber) {
      return NextResponse.json(
        { error: 'connectionId e phoneNumber são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar treinamento ativo desta conversa específica
    const training = await getActiveTrainingForChat(connectionId, phoneNumber);

    return NextResponse.json({
      success: true,
      training: training || null
    });
  } catch (error: any) {
    console.error('❌ Erro ao buscar treinamento ativo:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar treinamento ativo', details: error.message },
      { status: 500 }
    );
  }
}
