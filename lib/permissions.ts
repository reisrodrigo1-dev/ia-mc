import { User } from '@/types';

export function isSuperAdmin(user: User | null): boolean {
  return user?.role === 'super_admin';
}

export function isSectorAdmin(user: User | null, sectorId?: string): boolean {
  if (!user || !sectorId) return false;
  return user.role === 'sector_admin' && user.sectorId === sectorId;
}

export function canCreateSector(user: User | null): boolean {
  return isSuperAdmin(user);
}

export function canManageSector(user: User | null, sectorId: string): boolean {
  return isSuperAdmin(user) || isSectorAdmin(user, sectorId);
}

export function canManageUsers(user: User | null): boolean {
  return isSuperAdmin(user) || user?.role === 'sector_admin';
}

export function canAccessChat(
  user: User | null,
  chat: { ownerId: string; visibility: string; sectorId: string | null; allowedUsers: string[] }
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (chat.ownerId === user.id) return true;
  if (chat.visibility === 'sector' && chat.sectorId === user.sectorId) return true;
  if (chat.allowedUsers.includes(user.id)) return true;
  return false;
}
