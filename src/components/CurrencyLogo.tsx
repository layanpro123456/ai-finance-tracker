import React from 'react';
import { usePreferences } from '../context/PreferencesContext';

interface CurrencyLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'badge' | 'text' | 'icon' | 'input-prefix';
}

export const CurrencyLogo: React.FC<CurrencyLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'badge',
}) => {
  const { preferences } = usePreferences();
  const symbol = preferences.currencySymbol || '$';

  if (variant === 'text') {
    return <span className={`font-mono font-bold ${className}`}>{symbol}</span>;
  }

  if (variant === 'input-prefix') {
    return (
      <span
        className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs font-bold select-none pointer-events-none ${className}`}
      >
        {symbol}
      </span>
    );
  }

  if (variant === 'icon') {
    return (
      <span
        className={`inline-flex items-center justify-center font-bold font-mono rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 select-none shadow-sm ${
          size === 'xs'
            ? 'w-4 h-4 text-[9px]'
            : size === 'sm'
            ? 'w-5 h-5 text-[10px]'
            : size === 'lg'
            ? 'w-9 h-9 text-base'
            : 'w-7 h-7 text-xs'
        } ${className}`}
      >
        {symbol}
      </span>
    );
  }

  // default badge variant
  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 rounded-lg font-mono font-bold text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 select-none ${className}`}
    >
      {symbol}
    </span>
  );
};
