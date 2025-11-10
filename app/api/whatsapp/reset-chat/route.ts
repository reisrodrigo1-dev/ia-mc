import { NextRequest, NextResponse } from 'next/server';
import { deactivateTrainingForChat } from '@/lib/whatsapp/chat-sessions';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { connectionId, phoneNumber } = await req.json();

    if (!connectionId || !phoneNumber) {
      return NextResponse.json(
        { error: 'connectionId e phoneNumber são obrigatórios' },
        { status: 400 }
      );
    }

    console.log(`🔄 Resetando conversa: ${phoneNumber} na conexão ${connectionId}`);

    await deactivateTrainingForChat(connectionId, phoneNumber);

    return NextResponse.json({
      success: true,
      message: 'Conversa resetada com sucesso'
    });
  } catch (error: any) {
    console.error('❌ Erro ao resetar conversa:', error);
    return NextResponse.json(
      { error: 'Erro ao resetar conversa', details: error.message },
      { status: 500 }
    );
  }
}
