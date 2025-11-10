import { NextResponse } from 'next/server';
import { WhatsAppSessionManager } from '@/lib/whatsapp/session-manager';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const connections = WhatsAppSessionManager.getAllConnections();
    const activeConnections = Array.from(connections.entries()).map(([id, socket]) => ({
      id,
      connected: socket.user != null,
      phoneNumber: socket.user?.id.split(':')[0] || null,
      userName: socket.user?.name || null
    }));

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      whatsapp: {
        total: connections.size,
        active: activeConnections.filter(c => c.connected).length,
        connections: activeConnections
      }
    });
  } catch (error: any) {
    console.error('❌ Erro no health check:', error);
    return NextResponse.json(
      { 
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message 
      },
      { status: 500 }
    );
  }
}
