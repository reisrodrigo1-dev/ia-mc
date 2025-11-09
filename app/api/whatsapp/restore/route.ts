import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import * as fs from 'fs';

export async function POST(request: NextRequest) {
  try {
    const { connectionId } = await request.json();

    if (!connectionId) {
      return NextResponse.json(
        { error: 'connectionId é obrigatório' },
        { status: 400 }
      );
    }

    const sessionsPath = path.join(process.cwd(), 'whatsapp_sessions');
    const authPath = path.join(sessionsPath, connectionId);
    const credsPath = path.join(authPath, 'creds.json');

    // Verificar se tem credenciais salvas
    if (!fs.existsSync(credsPath)) {
      return NextResponse.json(
        { error: 'Nenhuma sessão salva encontrada para esta conexão' },
        { status: 404 }
      );
    }

    console.log(`🔄 Restaurando sessão: ${connectionId}`);

    // Importar dinamicamente para evitar problemas de módulo
    const connectModule = await import('../connect/route');
    
    // Chamar a função de criação de conexão
    // Como não podemos acessar createConnection diretamente, vamos fazer um POST interno
    const response = await fetch(`http://localhost:${process.env.PORT || 3000}/api/whatsapp/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ connectionId }),
    });

    if (response.ok) {
      console.log(`✅ Sessão restaurada: ${connectionId}`);
      return NextResponse.json({
        success: true,
        message: 'Sessão restaurada com sucesso'
      });
    } else {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao restaurar sessão');
    }

  } catch (error: any) {
    console.error('❌ Erro ao restaurar sessão:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao restaurar sessão', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionsPath = path.join(process.cwd(), 'whatsapp_sessions');
    
    if (!fs.existsSync(sessionsPath)) {
      return NextResponse.json({ sessions: [] });
    }

    const sessionDirs = fs.readdirSync(sessionsPath);
    const sessions = [];

    for (const connectionId of sessionDirs) {
      const authPath = path.join(sessionsPath, connectionId);
      const credsPath = path.join(authPath, 'creds.json');
      
      if (fs.existsSync(credsPath)) {
        sessions.push(connectionId);
      }
    }

    return NextResponse.json({ sessions });

  } catch (error: any) {
    console.error('❌ Erro ao listar sessões:', error);
    return NextResponse.json(
      { error: 'Erro ao listar sessões' },
      { status: 500 }
    );
  }
}
