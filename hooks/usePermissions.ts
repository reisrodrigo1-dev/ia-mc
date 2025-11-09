'use client';

import { useAuth } from './useAuth';
import {
  canCreateSector,
  canManageSector,
  canManageUsers,
  canAccessChat,
  isSuperAdmin,
} from '@/lib/permissions';

export function usePermissions() {
  const { user } = useAuth();

  return {
    canCreateSector: canCreateSector(user),
    canManageSector: (sectorId: string) => canManageSector(user, sectorId),
    canManageUsers: canManageUsers(user),
    canAccessChat: (chat: any) => canAccessChat(user, chat),
    isSuperAdmin: isSuperAdmin(user),
    user,
  };
}
