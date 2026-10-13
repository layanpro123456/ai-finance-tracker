import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Key,
  X,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { verifyAdminKey, setAdminSession, MASTER_ADMIN_KEY } from '../services/adminTelemetry';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthorized: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthorized,
}) => {
  const [passkey, setPasskey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (verifyAdminKey(passkey)) {
      setAdminSession(true);
      onAuthorized();
      onClose();
    } else {
      setError('Invalid Administrator Key. Please enter the correct master passkey.');
    }
  };

  const handleFillDemo = () => {
    setPasskey(MASTER_ADMIN_KEY);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
        {/* Glow accent */}
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-2xl border border-purple-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Admin Console Access
              </h3>
              <p className="text-[11px] text-slate-400">Platform Oversight &amp; User Telemetry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Zero Personal Data Policy</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Administrators oversee aggregate metrics, platform health, and non-sensitive user activity counts. Personal financial amounts, private notes, and debts remain strictly confidential.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-purple-400" />
              <span>Master Administrator Passkey</span>
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={passkey}
                onChange={(e) => {
                  setPasskey(e.target.value);
                  setError(null);
                }}
                placeholder="Enter master passkey..."
                className="w-full bg-slate-950 border border-slate-750 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] pt-1">
            <span className="text-slate-500">Demo Key: <code className="text-purple-300 font-mono">apex-admin-2026</code></span>
            <button
              type="button"
              onClick={handleFillDemo}
              className="text-purple-400 hover:text-purple-300 underline font-medium cursor-pointer"
            >
              Fill Key
            </button>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg shadow-purple-600/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Authorize Admin Session</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
