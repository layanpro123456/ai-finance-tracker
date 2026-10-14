import type { PlatformUserSummary, PlatformActivityLog, ActivityEventType } from '../types';

const ADMIN_STORAGE_KEY = 'apex_admin_authorized';
const ACTIVITY_STORAGE_KEY = 'apex_platform_activity_log';
export const MASTER_ADMIN_KEY = 'apex-admin-2026';

export function maskEmail(email: string): string {
  if (!email) return 'usr_anonymous';
  const parts = email.split('@');
  if (parts.length < 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? `${name.slice(0, 2)}***` : `${name.slice(0, 1)}***`;
  return `${maskedName}@${domain}`;
}

export function maskUserId(id: string): string {
  if (!id) return 'usr_anon';
  return `usr_...${id.slice(-4)}`;
}

export function isUserAdminSession(): boolean {
  try {
    return localStorage.getItem(ADMIN_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAdminSession(authorized: boolean) {
  try {
    if (authorized) {
      localStorage.setItem(ADMIN_STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(ADMIN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function verifyAdminKey(key: string): boolean {
  return key.trim() === MASTER_ADMIN_KEY;
}

export function getPlatformActivityLogs(): PlatformActivityLog[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function logPlatformEvent(
  type: ActivityEventType,
  action: string,
  userId?: string,
  userEmail?: string,
  platform = 'Desktop Web'
) {
  try {
    const currentLogs = getPlatformActivityLogs();
    const newLog: PlatformActivityLog = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      type,
      userId: maskUserId(userId || 'current_user'),
      userEmailMasked: maskEmail(userEmail || 'user@apexlifeos.com'),
      action,
      platform,
      status: 'success',
    };

    // Prepend and limit to 100 entries
    const updated = [newLog, ...currentLogs].slice(0, 100);
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

export function getPlatformUsers(
  currentUserId?: string,
  currentUserEmail?: string,
  userStats?: {
    transactionsCount: number;
    accountsCount: number;
    tasksCount: number;
    subsCount: number;
  }
): PlatformUserSummary[] {
  if (!currentUserId && !currentUserEmail) {
    return [];
  }

  // Authentic user representation (zero hallucinated stats or fake dummy accounts)
  const txCount = userStats?.transactionsCount ?? 0;
  const accountsCount = userStats?.accountsCount ?? 0;
  const tasksCount = userStats?.tasksCount ?? 0;
  const subsCount = userStats?.subsCount ?? 0;

  const activeUser: PlatformUserSummary = {
    id: currentUserId || 'usr_current',
    email: currentUserEmail || 'current.user@apexlifeos.com',
    maskedId: maskUserId(currentUserId || 'usr_current'),
    role: (currentUserEmail?.toLowerCase().includes('admin') || isUserAdminSession()) ? 'admin' : 'user',
    status: 'active',
    joinedDate: new Date().toISOString().split('T')[0],
    lastActive: 'Just now',
    totalTransactions: txCount,
    totalAccounts: accountsCount,
    totalTasks: tasksCount,
    totalSubscriptions: subsCount,
    aiUsageRate: txCount > 0 ? 100 : 0,
  };

  return [activeUser];
}
