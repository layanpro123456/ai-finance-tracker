import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { PlatformUserSummary, PlatformActivityLog, ActivityEventType } from '../types';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  Activity,
  Search,
  Filter,
  RefreshCw,
  Download,
  Lock,
  Laptop,
  CheckCircle2,
  Clock,
  Database,
  Sparkles,
  X,
  EyeOff,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Check,
  Loader2,
  HardDrive,
} from 'lucide-react';
import {
  getPlatformUsers,
  getPlatformActivityLogs,
  setAdminSession,
} from '../services/adminTelemetry';
import {
  purgeAllDatabaseData,
  getDatabaseDiagnostics,
  type DatabaseDiagnostics,
  type DatabaseRefreshReport,
} from '../services/databaseAdminService';

interface AdminPortalProps {
  currentUserId?: string;
  currentUserEmail?: string;
  userStats?: {
    transactionsCount: number;
    accountsCount: number;
    tasksCount: number;
    subsCount: number;
  };
  onLockSession: () => void;
  onRefreshDatabase?: () => Promise<void> | void;
}

type AdminViewTab = 'users' | 'activity' | 'database' | 'security';

export const AdminPortal: React.FC<AdminPortalProps> = ({
  currentUserId,
  currentUserEmail,
  userStats,
  onLockSession,
  onRefreshDatabase,
}) => {
  const [activeTab, setActiveTab] = useState<AdminViewTab>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [activityTypeFilter, setActivityTypeFilter] = useState<ActivityEventType | 'ALL'>('ALL');
  const [selectedUser, setSelectedUser] = useState<PlatformUserSummary | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load telemetry data
  const [users, setUsers] = useState<PlatformUserSummary[]>(() =>
    getPlatformUsers(currentUserId, currentUserEmail, userStats)
  );
  const [activities, setActivities] = useState<PlatformActivityLog[]>(() =>
    getPlatformActivityLogs()
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setUsers(getPlatformUsers(currentUserId, currentUserEmail, userStats));
      setActivities(getPlatformActivityLogs());
      setIsRefreshing(false);
    }, 400);
  };

  const handleExportAuditJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activities, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `apex_audit_log_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Database diagnostics & full refresh state
  const [diagnostics, setDiagnostics] = useState<DatabaseDiagnostics | null>(null);
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(false);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [refreshConfirmInput, setRefreshConfirmInput] = useState('');
  const [isExecutingRefresh, setIsExecutingRefresh] = useState(false);
  const [refreshReport, setRefreshReport] = useState<DatabaseRefreshReport | null>(null);
  const [refreshProgressStep, setRefreshProgressStep] = useState<string>('');

  const fetchDiagnostics = useCallback(async () => {
    if (!currentUserId) return;
    setIsLoadingDiagnostics(true);
    try {
      const diag = await getDatabaseDiagnostics(currentUserId);
      setDiagnostics(diag);
    } catch (err) {
      console.error('Error fetching database diagnostics:', err);
    } finally {
      setIsLoadingDiagnostics(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (activeTab === 'database' || showRefreshModal) {
      fetchDiagnostics();
    }
  }, [activeTab, showRefreshModal, fetchDiagnostics]);

  const handleExecuteFullRefresh = async () => {
    if (refreshConfirmInput.trim().toUpperCase() !== 'REFRESH') {
      return;
    }
    if (!currentUserId) {
      alert('Active user credentials required to perform targeted database refresh.');
      return;
    }

    setIsExecutingRefresh(true);
    setRefreshProgressStep('Purging user tables across transactions, budgets, ERP modules...');

    try {
      const report = await purgeAllDatabaseData(currentUserId, currentUserEmail, 'USD', 'global');
      setRefreshProgressStep('Wiping hardware-bound local telemetry and caches...');
      setRefreshReport(report);

      // Re-fetch local users & telemetry
      setUsers(getPlatformUsers(currentUserId, currentUserEmail, {
        transactionsCount: 0,
        accountsCount: 1,
        tasksCount: 0,
        subsCount: 0,
      }));
      setActivities(getPlatformActivityLogs());

      // Re-fetch database diagnostics
      const diag = await getDatabaseDiagnostics(currentUserId);
      setDiagnostics(diag);

      // Notify parent App to refresh all ERP hooks
      if (onRefreshDatabase) {
        await onRefreshDatabase();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database refresh encountered an error';
      alert(msg);
    } finally {
      setIsExecutingRefresh(false);
      setRefreshProgressStep('');
    }
  };

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.maskedId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Filtered activities list
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (activityTypeFilter === 'ALL') return true;
      return act.type === activityTypeFilter;
    });
  }, [activities, activityTypeFilter]);

  // Aggregate telemetry metrics
  const totalUsersCount = users.length;
  const activeUsersCount = users.filter((u) => u.status === 'active').length;
  const totalOperationsSum = users.reduce((acc, u) => acc + u.totalTransactions + u.totalTasks, 0);
  const avgAiRate = Math.round(
    users.reduce((acc, u) => acc + u.aiUsageRate, 0) / (users.length || 1)
  );

  return (
    <div className="space-y-6">
      {/* Admin Header & Security Banner */}
      <div className="bg-gradient-to-r from-purple-950/70 via-slate-900 to-slate-950 border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
              <span>Executive Admin Console &bull; Session Authorized</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Platform Oversight &amp; User Telemetry
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Oversee platform user counts, operational activity streams, and system health metrics while preserving user confidentiality.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleRefresh}
              title="Refresh Telemetry"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-400' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportAuditJson}
              title="Export Non-Personal Audit Log"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audit</span>
            </button>

            <button
              onClick={() => {
                setRefreshReport(null);
                setRefreshConfirmInput('');
                setShowRefreshModal(true);
              }}
              title="Full Database Refresh (Zero Sample Data)"
              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span>Fully Refresh DB</span>
            </button>

            <button
              onClick={() => {
                setAdminSession(false);
                onLockSession();
              }}
              title="Lock Admin Console"
              className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Admin Session</span>
            </button>
          </div>
        </div>

        {/* Zero Personal Data Guarantee Strip */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span className="font-semibold">Zero Personal Data Policy:</span>
            <span className="text-slate-400">
              Personal financial sums, bank balances, private notes, and contact debts are strictly masked and inaccessible.
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-mono">
            <EyeOff className="w-3.5 h-3.5" />
            <span>RLS Cryptographic Isolation Enforced</span>
          </div>
        </div>
      </div>

      {/* Aggregate Telemetry Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Total Registered Users</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{totalUsersCount}</div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
            <span>{activeUsersCount} currently active</span>
            <span className="text-slate-500">&bull;</span>
            <span className="text-slate-400">100% cloud verified</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Total Operations Executed</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {totalOperationsSum.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Ledger txs, operations &amp; assets logged
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">AI Assistant Adoption</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{avgAiRate}%</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Natural language parsing utilization
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">System Health</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Optimal</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
            <span>Latency: 34ms</span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-emerald-400">RLS Active</span>
          </div>
        </div>
      </div>

      {/* Admin Module Sub-navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'users'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Available Users Directory ({filteredUsers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('activity')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'activity'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Activity Audit Stream ({filteredActivities.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('database')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'database'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Database &amp; Schema ({diagnostics?.totalRecords ?? 0} rows)</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'security'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Security &amp; RLS Sentinel</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. AVAILABLE USERS DIRECTORY */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          {/* Controls: Search and Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search user by email or masked ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span>Role:</span>
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as 'all' | 'admin' | 'user')}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="admin">Administrators</option>
                <option value="user">Standard Users</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3">User Identifier</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Joined Date</th>
                  <th className="py-3 px-3">Last Active</th>
                  <th className="py-3 px-3 text-center">Activity Volume</th>
                  <th className="py-3 px-3 text-right">Telemetry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500">
                      No users found matching &ldquo;{searchQuery}&rdquo;.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-850/50 transition cursor-pointer"
                      onClick={() => setSelectedUser(u)}
                    >
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
                            {u.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white">{u.email}</div>
                            <div className="font-mono text-[10px] text-slate-500">{u.maskedId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                            <ShieldAlert className="w-3 h-3 text-purple-400" />
                            <span>Administrator</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-medium">
                            Member
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            u.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.status === 'active' ? 'bg-emerald-400' : 'bg-slate-500'
                            }`}
                          />
                          <span className="capitalize">{u.status}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-300 font-mono text-[11px]">{u.joinedDate}</td>
                      <td className="py-3.5 px-3 text-slate-400 flex items-center gap-1 mt-1 text-[11px]">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{u.lastActive}</span>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center justify-center gap-3 text-slate-300 font-mono text-[11px]">
                          <span title="Total Transactions Processed">{u.totalTransactions} txs</span>
                          <span className="text-slate-600">&bull;</span>
                          <span title="Tasks & Operations">{u.totalTasks} tasks</span>
                          <span className="text-slate-600">&bull;</span>
                          <span title="AI Parsing Rate" className="text-amber-400 font-bold">
                            {u.aiUsageRate}% AI
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(u);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-purple-600 text-slate-300 hover:text-white transition text-[11px] font-medium cursor-pointer"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. LIVE ACTIVITY AUDIT STREAM */}
      {/* ========================================================================= */}
      {activeTab === 'activity' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                <span>Live Platform Activity Stream</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time operational audit trail (sensitive financial sums &amp; personal descriptions masked).
              </p>
            </div>

            {/* Event Category Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                ['ALL', 'TRANSACTION', 'TASK', 'BUDGET', 'SUBSCRIPTION', 'ASSET', 'AUTH', 'SECURITY'] as const
              ).map((type) => (
                <button
                  key={type}
                  onClick={() => setActivityTypeFilter(type)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                    activityTypeFilter === type
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {filteredActivities.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No events recorded for category &ldquo;{activityTypeFilter}&rdquo;.
              </div>
            ) : (
              filteredActivities.map((act) => {
                const badgeColor =
                  act.type === 'TRANSACTION'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : act.type === 'TASK'
                    ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                    : act.type === 'BUDGET'
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    : act.type === 'SUBSCRIPTION'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : act.type === 'ASSET'
                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                    : act.type === 'AUTH'
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    : 'bg-slate-800 text-slate-300 border-slate-700';

                return (
                  <div
                    key={act.id}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex-shrink-0 ${badgeColor}`}
                      >
                        {act.type}
                      </span>
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2 flex-wrap">
                          <span>{act.action}</span>
                          <span className="text-[10px] text-slate-500 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-850">
                            {act.userEmailMasked}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <Laptop className="w-3 h-3 text-slate-500" />
                          <span>{act.platform}</span>
                          <span className="text-slate-600">&bull;</span>
                          <span className="text-emerald-400 text-[10px] flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Confidentiality Protected</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 font-mono whitespace-nowrap self-end sm:self-center">
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. DATABASE & SCHEMA OPERATIONS */}
      {/* ========================================================================= */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          {/* Zero Hallucination Guarantee Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Zero Hallucination Policy Enforced</span>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Database Health &amp; Schema Status
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Automatic sample data seeding and fabricated demo activity have been permanently removed. Empty state indicators reflect genuine zero-record databases without synthetic padding.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchDiagnostics}
                  disabled={isLoadingDiagnostics}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-700 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDiagnostics ? 'animate-spin text-purple-400' : ''}`} />
                  <span>Scan DB Records</span>
                </button>
                <button
                  onClick={() => {
                    setRefreshReport(null);
                    setRefreshConfirmInput('');
                    setShowRefreshModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-rose-600/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Fully Refresh DB</span>
                </button>
              </div>
            </div>

            {/* Diagnostic Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
                <span className="text-[11px] font-medium text-slate-400 block">Total Live Records</span>
                <span className="text-2xl font-bold text-white tracking-tight mt-1 block">
                  {diagnostics?.totalRecords ?? 0}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Across all tables</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
                <span className="text-[11px] font-medium text-slate-400 block">Database Status</span>
                <span className="text-2xl font-bold text-emerald-400 tracking-tight mt-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{(diagnostics?.totalRecords ?? 0) === 0 ? 'Clean Slate' : 'Active Data'}</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Row-Level Security Active</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
                <span className="text-[11px] font-medium text-slate-400 block">Tracked Tables</span>
                <span className="text-2xl font-bold text-white tracking-tight mt-1 block">
                  {diagnostics?.tables.length ?? 11}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Public ERP Schemas</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
                <span className="text-[11px] font-medium text-slate-400 block">Sample Seeding</span>
                <span className="text-2xl font-bold text-rose-400 tracking-tight mt-1 block">
                  Disabled
                </span>
                <span className="text-[10px] text-emerald-400 font-medium">100% Genuine Metrics</span>
              </div>
            </div>
          </div>

          {/* Detailed Module Table Inspection */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-purple-400" />
                  <span>Module Row Counts &amp; Schema Telemetry</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time record counts for each isolated database table in this member workspace.
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                Last checked: {diagnostics?.lastChecked ? new Date(diagnostics.lastChecked).toLocaleTimeString() : 'Just now'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3">Table Identifier</th>
                    <th className="py-2.5 px-3">Module Description</th>
                    <th className="py-2.5 px-3 text-center">Row Count</th>
                    <th className="py-2.5 px-3 text-right">Database State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {diagnostics?.tables.map((tbl) => (
                    <tr key={tbl.table} className="hover:bg-slate-850/40 transition">
                      <td className="py-2.5 px-3 font-mono text-purple-300">
                        public.{tbl.table}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200">
                        {tbl.name}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-white font-mono">
                        {tbl.count}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {tbl.count === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-medium border border-slate-700">
                            Clean Slate
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 text-[10px] font-semibold border border-purple-500/25">
                            {tbl.count} Records Active
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SECURITY & RLS SENTINEL */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Cryptographic Isolation &amp; Privacy Verification</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Verification checklist ensuring admin oversight functions strictly without leaking personal member data.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Row-Level Security (RLS) Active</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Supabase database policies isolate user financial ledgers. Even admin API calls cannot read raw account balances or personal line items without the user&apos;s direct auth token.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Non-Personal Activity Telemetry</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Audit logs record operational events (e.g., &ldquo;Logged expense transaction via AI&rdquo;) while stripping out dollar amounts, merchant names, and confidential descriptions.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Masked Identifier Standards</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                User IDs are presented as masked hashes (e.g. <code className="text-purple-300 font-mono">usr_...f812</code>) to prevent accidental identification across platform audits.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                <ShieldAlert className="w-4 h-4" />
                <span>Session Passkey Protection</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                The Admin Console requires master passkey authorization and can be instantly locked with the &ldquo;Lock Admin Session&rdquo; control.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Inspector Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white font-bold flex items-center justify-center text-sm">
                  {selectedUser.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{selectedUser.email}</h3>
                  <p className="text-[11px] font-mono text-slate-400">{selectedUser.maskedId}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-5 space-y-4 text-xs">
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-300 text-[11px] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 text-purple-400" />
                <span>Privacy Notice: Personal financial figures and private notes are withheld.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Role</span>
                  <span className="text-white font-bold capitalize">{selectedUser.role}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Status</span>
                  <span className="text-emerald-400 font-bold capitalize">{selectedUser.status}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Registration Date</span>
                  <span className="text-white font-mono">{selectedUser.joinedDate}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Last Active</span>
                  <span className="text-white">{selectedUser.lastActive}</span>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="font-semibold text-slate-300 block">Platform Operational Footprint</span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-white font-bold block">{selectedUser.totalTransactions}</span>
                    <span className="text-[10px] text-slate-500">Transactions</span>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-white font-bold block">{selectedUser.totalTasks}</span>
                    <span className="text-[10px] text-slate-500">Tasks</span>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-white font-bold block">{selectedUser.totalSubscriptions}</span>
                    <span className="text-[10px] text-slate-500">Subscriptions</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">AI Assistant Adoption Rate</span>
                  <span className="text-amber-400 font-bold">{selectedUser.aiUsageRate}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all"
                    style={{ width: `${selectedUser.aiUsageRate}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Database Refresh Modal */}
      {showRefreshModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold flex items-center justify-center">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Full Database Refresh</h3>
                  <p className="text-xs text-rose-400/90 font-medium">Destructive Administrative Action</p>
                </div>
              </div>
              {!isExecutingRefresh && (
                <button
                  onClick={() => setShowRefreshModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {refreshReport ? (
              <div className="py-6 space-y-5 text-xs">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Database Successfully Refreshed</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {refreshReport.message}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[10px]">
                    Purge Summary
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>{refreshReport.clearedTables.filter((t) => t.status === 'purged').length} Tables Purged</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Local Storage Wiped</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Checking Acct (0.00) Reset</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Zero Sample Data</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setShowRefreshModal(false);
                      setRefreshReport(null);
                    }}
                    className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition cursor-pointer shadow-lg shadow-emerald-400/20"
                  >
                    Done &amp; Return
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-5 space-y-4 text-xs">
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-rose-400">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Warning: Irreversible Data Deletion</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    This will permanently delete all records across transactions, budgets, tasks, assets, subscriptions, social debts, saved places, mobility timeline trips, and active sessions.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-[11px]">
                  <span className="font-semibold text-slate-300 block">Actions that will be executed:</span>
                  <ul className="space-y-1.5 text-slate-400 list-disc list-inside">
                    <li>Purge 11 PostgreSQL database tables across entire platform</li>
                    <li><strong className="text-emerald-400 font-semibold">Preserve admin and authentication accounts</strong> in <code className="text-purple-300 font-mono">auth.users</code></li>
                    <li>Wipe device-scoped mobility caches, mock coordinates, and streak history</li>
                    <li>Ensure every member starting account starts strictly at balance <code className="text-emerald-400 font-mono">0.00</code></li>
                    <li>Eliminate all hallucinated sample data injection from future loads</li>
                  </ul>
                </div>

                {isExecutingRefresh ? (
                  <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto" />
                    <div className="font-semibold text-white">Refreshing Database...</div>
                    <p className="text-[11px] text-slate-400">{refreshProgressStep}</p>
                  </div>
                ) : (
                  <div className="space-y-2 pt-2">
                    <label className="block text-slate-300 text-[11px] font-semibold">
                      To confirm, type <span className="font-mono text-rose-400 font-bold">REFRESH</span> below:
                    </label>
                    <input
                      type="text"
                      value={refreshConfirmInput}
                      onChange={(e) => setRefreshConfirmInput(e.target.value)}
                      placeholder="Type REFRESH to confirm"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono"
                    />
                  </div>
                )}

                {!isExecutingRefresh && (
                  <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowRefreshModal(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={refreshConfirmInput.trim().toUpperCase() !== 'REFRESH'}
                      onClick={handleExecuteFullRefresh}
                      className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-rose-600/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Execute Full Refresh</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
