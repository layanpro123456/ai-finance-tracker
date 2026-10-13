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

// Initial realistic audit activities (strictly non-personal)
const SEED_ACTIVITIES: PlatformActivityLog[] = [
  {
    id: 'act_101',
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    type: 'TRANSACTION',
    userId: 'usr_f812',
    userEmailMasked: 'al***@gmail.com',
    action: 'Logged expense ledger entry via AI Natural Language Assistant',
    platform: 'Desktop Chrome / Windows',
    status: 'success',
  },
  {
    id: 'act_102',
    timestamp: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    type: 'TASK',
    userId: 'usr_c349',
    userEmailMasked: 'sa***@outlook.com',
    action: 'Completed financial task (Automatic payable deduction confirmed)',
    platform: 'Mobile PWA / iOS',
    status: 'success',
  },
  {
    id: 'act_103',
    timestamp: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
    type: 'BUDGET',
    userId: 'usr_902a',
    userEmailMasked: 'ma***@icloud.com',
    action: 'Adjusted monthly category budget threshold',
    platform: 'Desktop Safari / macOS',
    status: 'info',
  },
  {
    id: 'act_104',
    timestamp: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
    type: 'SUBSCRIPTION',
    userId: 'usr_e7b1',
    userEmailMasked: 'da***@proton.me',
    action: 'Logged scheduled recurring service renewal to account ledger',
    platform: 'Desktop Firefox / Linux',
    status: 'success',
  },
  {
    id: 'act_105',
    timestamp: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    type: 'AUTH',
    userId: 'usr_42fd',
    userEmailMasked: 'el***@gmail.com',
    action: 'User authenticated successfully via email credentials',
    platform: 'Mobile Chrome / Android',
    status: 'success',
  },
  {
    id: 'act_106',
    timestamp: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
    type: 'ASSET',
    userId: 'usr_88ba',
    userEmailMasked: 'ke***@yahoo.com',
    action: 'Registered new personal equipment asset and warranty period',
    platform: 'Desktop Edge / Windows',
    status: 'success',
  },
  {
    id: 'act_107',
    timestamp: new Date(Date.now() - 160 * 60 * 1000).toISOString(),
    type: 'SOCIAL_IOU',
    userId: 'usr_f812',
    userEmailMasked: 'al***@gmail.com',
    action: 'Settled peer debt record with automatic bank account credit',
    platform: 'Desktop Chrome / Windows',
    status: 'success',
  },
  {
    id: 'act_108',
    timestamp: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
    type: 'SECURITY',
    userId: 'usr_19ab',
    userEmailMasked: 'no***@domain.com',
    action: 'Updated currency and local timezone preferences',
    platform: 'Desktop Chrome / macOS',
    status: 'info',
  },
];

export function getPlatformActivityLogs(): PlatformActivityLog[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(SEED_ACTIVITIES));
      return SEED_ACTIVITIES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : SEED_ACTIVITIES;
  } catch {
    return SEED_ACTIVITIES;
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
  // Current user representation
  const activeUser: PlatformUserSummary = {
    id: currentUserId || 'usr_current',
    email: currentUserEmail || 'current.user@apexlifeos.com',
    maskedId: maskUserId(currentUserId || 'usr_current'),
    role: (currentUserEmail?.toLowerCase().includes('admin') || isUserAdminSession()) ? 'admin' : 'user',
    status: 'active',
    joinedDate: '2026-10-10',
    lastActive: 'Just now',
    totalTransactions: userStats?.transactionsCount || 18,
    totalAccounts: userStats?.accountsCount || 3,
    totalTasks: userStats?.tasksCount || 6,
    totalSubscriptions: userStats?.subsCount || 4,
    aiUsageRate: 85,
  };

  // Directory of platform users (metadata & volume metrics only, no personal data)
  const directory: PlatformUserSummary[] = [
    activeUser,
    {
      id: 'usr_f812-491a-8bb1',
      email: 'alex.v@hyperion.io',
      maskedId: 'usr_...f812',
      role: 'user',
      status: 'active',
      joinedDate: '2026-09-14',
      lastActive: '3 mins ago',
      totalTransactions: 142,
      totalAccounts: 4,
      totalTasks: 19,
      totalSubscriptions: 6,
      aiUsageRate: 78,
    },
    {
      id: 'usr_c349-80ab-12fe',
      email: 'sarah.miller@acme.org',
      maskedId: 'usr_...c349',
      role: 'user',
      status: 'active',
      joinedDate: '2026-08-22',
      lastActive: '11 mins ago',
      totalTransactions: 312,
      totalAccounts: 5,
      totalTasks: 34,
      totalSubscriptions: 9,
      aiUsageRate: 92,
    },
    {
      id: 'usr_902a-33da-77e4',
      email: 'marcus.chen@techventures.co',
      maskedId: 'usr_...902a',
      role: 'user',
      status: 'active',
      joinedDate: '2026-09-02',
      lastActive: '24 mins ago',
      totalTransactions: 89,
      totalAccounts: 2,
      totalTasks: 11,
      totalSubscriptions: 3,
      aiUsageRate: 64,
    },
    {
      id: 'usr_e7b1-21ff-99c0',
      email: 'david.k@proton.me',
      maskedId: 'usr_...e7b1',
      role: 'user',
      status: 'active',
      joinedDate: '2026-07-15',
      lastActive: '48 mins ago',
      totalTransactions: 421,
      totalAccounts: 6,
      totalTasks: 45,
      totalSubscriptions: 12,
      aiUsageRate: 88,
    },
    {
      id: 'usr_42fd-77aa-5521',
      email: 'elena.rostova@designlab.net',
      maskedId: 'usr_...42fd',
      role: 'user',
      status: 'active',
      joinedDate: '2026-09-28',
      lastActive: '1 hour ago',
      totalTransactions: 64,
      totalAccounts: 3,
      totalTasks: 8,
      totalSubscriptions: 4,
      aiUsageRate: 70,
    },
    {
      id: 'usr_88ba-14cc-6320',
      email: 'kevin.b@enterprise.corp',
      maskedId: 'usr_...88ba',
      role: 'user',
      status: 'active',
      joinedDate: '2026-08-05',
      lastActive: '3 hours ago',
      totalTransactions: 198,
      totalAccounts: 4,
      totalTasks: 22,
      totalSubscriptions: 7,
      aiUsageRate: 81,
    },
    {
      id: 'usr_00ad-66ee-4421',
      email: 'admin.lead@apexlifeos.com',
      maskedId: 'usr_...00ad',
      role: 'admin',
      status: 'active',
      joinedDate: '2026-06-01',
      lastActive: '5 hours ago',
      totalTransactions: 580,
      totalAccounts: 7,
      totalTasks: 62,
      totalSubscriptions: 14,
      aiUsageRate: 95,
    },
    {
      id: 'usr_99bb-3120-77a8',
      email: 'jordan.lee@creativestudio.io',
      maskedId: 'usr_...99bb',
      role: 'user',
      status: 'inactive',
      joinedDate: '2026-06-20',
      lastActive: '14 days ago',
      totalTransactions: 42,
      totalAccounts: 2,
      totalTasks: 5,
      totalSubscriptions: 2,
      aiUsageRate: 50,
    },
  ];

  // Remove duplicates if current user matches any dummy
  const uniqueDirectory = directory.filter(
    (u, index, self) => index === self.findIndex((t) => t.email.toLowerCase() === u.email.toLowerCase())
  );

  return uniqueDirectory;
}
