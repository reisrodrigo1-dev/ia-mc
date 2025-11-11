// Módulo compartilhado para gerenciar sessões ativas do WhatsApp
// Este arquivo é importado tanto pelo /connect quanto pelo /send

// Map global para armazenar sessões ativas
// Estrutura das chaves:
// - connectionId: socket do Baileys
// - ${connectionId}_status: string (connected, qr-code, etc)
// - ${connectionId}_qr: string (QR code em base64)
// - ${connectionId}_phone: string (número do telefone)
// - ${connectionId}_user: objeto (dados do usuário)
export const activeSessions = new Map<string, any>();
export const pendingReconnections = new Map<string, NodeJS.Timeout>();
export const reconnectionDelays = new Map<string, number>();

export function getActiveSession(connectionId: string): any | undefined {
  return activeSessions.get(connectionId);
}

export function getSessionStatus(connectionId: string): string | undefined {
  return activeSessions.get(`${connectionId}_status`);
}

export function getSessionPhone(connectionId: string): string | undefined {
  return activeSessions.get(`${connectionId}_phone`);
}

export function getSessionQR(connectionId: string): string | undefined {
  return activeSessions.get(`${connectionId}_qr`);
}

export function getSessionUser(connectionId: string): any | undefined {
  return activeSessions.get(`${connectionId}_user`);
}

export function setActiveSession(key: string, value: any): void {
  activeSessions.set(key, value);
}

export function deleteActiveSession(connectionId: string): void {
  activeSessions.delete(connectionId);
  activeSessions.delete(`${connectionId}_status`);
  activeSessions.delete(`${connectionId}_qr`);
  activeSessions.delete(`${connectionId}_phone`);
  activeSessions.delete(`${connectionId}_user`);
}

export function getAllActiveSessions(): Map<string, any> {
  return activeSessions;
}
