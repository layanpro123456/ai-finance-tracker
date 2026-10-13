import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { usePreferences } from '../context/PreferencesContext';
import {
  registerDeviceSession,
  getDeviceName,
  getDeviceId,
} from '../services/deviceSessionService';
import {
  Lock,
  Mail,
  Sparkles,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Sun,
  Moon,
  Wallet,
  CheckSquare,
  Package,
  Layers,
  Smartphone,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';

interface AuthModalProps {
  onSuccess: () => void;
  initialConflictNotice?: { activeDeviceName: string } | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, initialConflictNotice }) => {
  const { preferences, toggleTheme } = usePreferences();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Single-device conflict state
  const [deviceConflict, setDeviceConflict] = useState<{
    userId: string;
    activeDeviceName: string;
    lastActive?: string;
  } | null>(null);

  const thisDeviceName = getDeviceName();
  const thisDeviceId = getDeviceId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setDeviceConflict(null);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        if (data.session && data.session.user) {
          const reg = await registerDeviceSession(data.session.user.id, false);
          if (!reg.allowed) {
            setDeviceConflict({
              userId: data.session.user.id,
              activeDeviceName: reg.activeDeviceName || 'Another Device',
              lastActive: reg.lastActive,
            });
            return;
          }
          onSuccess();
        } else {
          setMessage('Account created! Please check your email to verify your address or log in.');
        }
      } else {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        if (signInData.user) {
          const reg = await registerDeviceSession(signInData.user.id, false);
          if (!reg.allowed) {
            // Simultaneous multi-device login detected!
            setDeviceConflict({
              userId: signInData.user.id,
              activeDeviceName: reg.activeDeviceName || 'Another Device',
              lastActive: reg.lastActive,
            });
            return;
          }
          onSuccess();
        }
      }
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'An error occurred during authentication.';
      setError(errMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForceTransferSession = async () => {
    if (!deviceConflict) return;
    setLoading(true);
    setError(null);

    try {
      const reg = await registerDeviceSession(deviceConflict.userId, true);
      if (reg.allowed) {
        setDeviceConflict(null);
        onSuccess();
      } else {
        setError('Could not transfer session. Please try again.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Session transfer failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelConflict = async () => {
    setDeviceConflict(null);
    await supabase.auth.signOut();
  };


  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-950 text-slate-100 relative selection:bg-emerald-500 selection:text-slate-950">
      {/* Top right theme toggle */}
      <div className="absolute top-5 right-5 z-20">
        <button
          onClick={toggleTheme}
          type="button"
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition shadow-lg cursor-pointer flex items-center gap-2 text-xs font-medium"
          title={`Switch to ${preferences.theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          {preferences.theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">Dark Mode</span>
            </>
          )}
        </button>
      </div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-9 shadow-2xl relative overflow-hidden">
        {/* Glow accents */}
        <div className="absolute -top-24 -right-24 w-52 h-52 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Branding & Logo */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-xl shadow-emerald-500/20 mb-3.5">
            <Sparkles className="w-7 h-7 text-slate-950" />
          </div>

          <div className="flex items-center justify-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Apex LifeOS
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
              ERP
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-400 max-w-xs mx-auto">
            Personal Life Operating System &amp; Finance Engine
          </p>

          {/* Feature Highlights Pills */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60">
              <Wallet className="w-3 h-3 text-emerald-400" />
              Finance Hub
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60">
              <CheckSquare className="w-3 h-3 text-sky-400" />
              Daily Tasks
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60">
              <Package className="w-3 h-3 text-amber-400" />
              Asset Vault
            </span>
          </div>
        </div>

        {/* Conflict Notice if kicked out from another device */}
        {initialConflictNotice && !deviceConflict && (
          <div className="mb-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5 shadow-lg shadow-amber-500/5">
            <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="leading-snug">
              <span className="font-bold text-amber-300">Session Ended on Previous Device:</span>
              <p className="mt-0.5 text-amber-200/90">
                Your account was claimed by another device ({initialConflictNotice.activeDeviceName}). Apex LifeOS restricts access to 1 physical device at a time for location telemetry accuracy.
              </p>
            </div>
          </div>
        )}

        {/* If Active Device Conflict is encountered */}
        {deviceConflict ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-gradient-to-b from-amber-500/15 to-amber-950/20 border border-amber-500/30 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400 border border-amber-500/30 shadow-lg">
                <Smartphone className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">
                Account Active on Another Device
              </h3>
              <p className="text-xs text-amber-200/80 mb-3 max-w-xs mx-auto">
                This account is currently active on:
              </p>
              <div className="inline-block px-3 py-1.5 rounded-xl bg-slate-950/80 border border-amber-500/40 text-xs font-mono font-bold text-amber-300 mb-3">
                📱 {deviceConflict.activeDeviceName}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed text-left bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <strong className="text-slate-300">Why is this blocked?</strong> Apex LifeOS records real-time physical mobility routes, geofences, and transport speeds that are bound to a single physical device to prevent location timeline contamination.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleForceTransferSession}
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-bold py-3 px-4 rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer text-xs"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Transfer Session to This Device</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCancelConflict}
                disabled={loading}
                className="w-full bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-semibold py-2.5 px-4 rounded-xl border border-slate-700/60 flex items-center justify-center gap-2 transition cursor-pointer text-xs"
              >
                Cancel &amp; Keep Other Device Active
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tab switch */}
            <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800 mb-6">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setError(null);
                  setMessage(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  !isSignUp
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setError(null);
                  setMessage(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  isSignUp
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="leading-snug">{error}</div>
              </div>
            )}

            {message && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="leading-snug">{message}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full bg-slate-950 border border-slate-750 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-950 border border-slate-750 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold py-3 px-4 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer text-sm"
              >
                {loading ? (
                  <span className="inline-block w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{isSignUp ? 'Get Started with Apex LifeOS' : 'Enter Dashboard'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {/* Hardware & Single Device Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1">
          <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span>{thisDeviceName}</span>
            <span className="text-slate-600">•</span>
            <span className="text-[10px] text-slate-500">ID: {thisDeviceId.slice(0, 12)}...</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <Layers className="w-3 h-3 text-slate-600" />
            <span>Apex LifeOS • Single Active Device Lock</span>
          </div>
        </div>
      </div>
    </div>
  );
};
