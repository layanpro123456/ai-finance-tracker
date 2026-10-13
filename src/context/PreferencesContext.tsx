import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export interface UserPreferences {
  currency: string;
  currencySymbol: string;
  country: string;
  timezone: string;
  theme: 'dark' | 'light';
}

export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar ($)' },
  { code: 'EUR', symbol: '€', name: 'Euro (€)' },
  { code: 'GBP', symbol: '£', name: 'British Pound (£)' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar (CA$)' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar (A$)' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen (¥)' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan (¥)' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc (CHF)' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar (S$)' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham (AED)' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real (R$)' },
  { code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso (Mex$)' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar (NZ$)' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona (kr)' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand (R)' },
];

export const COUNTRIES = [
  'United States',
  'United Kingdom',
  'India',
  'Canada',
  'Australia',
  'Germany',
  'France',
  'Japan',
  'United Arab Emirates',
  'Singapore',
  'Switzerland',
  'Brazil',
  'Netherlands',
  'Spain',
  'Italy',
  'Sweden',
  'South Africa',
  'Mexico',
  'Other',
];

export const TIMEZONES = [
  { id: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { id: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { id: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { id: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { id: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { id: 'Europe/London', label: 'London, Dublin (GMT / BST)' },
  { id: 'Europe/Paris', label: 'Paris, Rome, Madrid, Berlin (CET)' },
  { id: 'Europe/Berlin', label: 'Berlin, Frankfurt, Amsterdam' },
  { id: 'Asia/Kolkata', label: 'India Standard Time (IST - Mumbai, Delhi)' },
  { id: 'Asia/Dubai', label: 'Dubai, Abu Dhabi, Muscat (GST)' },
  { id: 'Asia/Singapore', label: 'Singapore, Kuala Lumpur (SGT)' },
  { id: 'Asia/Tokyo', label: 'Tokyo, Osaka (JST)' },
  { id: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
  { id: 'Australia/Sydney', label: 'Sydney, Melbourne, Canberra (AEST)' },
  { id: 'Pacific/Auckland', label: 'Auckland, Wellington (NZST)' },
];

const PREFS_STORAGE_KEY = 'apex_user_preferences';

function getInitialPreferences(): UserPreferences {
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const defaultPrefs: UserPreferences = {
    currency: 'USD',
    currencySymbol: '$',
    country: 'United States',
    timezone: detectedTimezone,
    theme: 'dark',
  };

  try {
    const stored = localStorage.getItem(PREFS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultPrefs, ...parsed };
    }
  } catch (e) {
    console.warn('Could not parse stored preferences:', e);
  }

  return defaultPrefs;
}

interface PreferencesContextValue {
  preferences: UserPreferences;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  updatePreferences: (newPrefs: Partial<UserPreferences>) => void;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string | Date | number, options?: Intl.DateTimeFormatOptions) => string;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<UserPreferences>(getInitialPreferences);

  // Sync theme class to document root element
  useEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
  }, [preferences.theme]);

  // Save to localStorage whenever preferences change
  const updatePreferences = useCallback((newPrefs: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      let updated = { ...prev, ...newPrefs };

      // Update currency symbol if currency code changed
      if (newPrefs.currency) {
        const found = CURRENCIES.find((c) => c.code === newPrefs.currency);
        if (found) {
          updated.currencySymbol = found.symbol;
        }
      }

      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(updated));

      // Attempt to sync to Supabase user metadata in background
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          supabase.auth.updateUser({
            data: { preferences: updated },
          }).catch((err) => console.warn('Could not sync preferences to cloud:', err));
        }
      });

      return updated;
    });
  }, []);

  const setTheme = useCallback((theme: 'dark' | 'light') => {
    updatePreferences({ theme });
  }, [updatePreferences]);

  const toggleTheme = useCallback(() => {
    setTheme(preferences.theme === 'dark' ? 'light' : 'dark');
  }, [preferences.theme, setTheme]);

  // Format currency according to user currency selection
  const formatCurrency = useCallback((amount: number) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: preferences.currency,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${preferences.currencySymbol}${Number(amount).toFixed(2)}`;
    }
  }, [preferences.currency, preferences.currencySymbol]);

  // Format date according to user timezone selection
  const formatDate = useCallback((dateInput: string | Date | number, options?: Intl.DateTimeFormatOptions) => {
    try {
      const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
      const defaultOptions: Intl.DateTimeFormatOptions = {
        timeZone: preferences.timezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...options,
      };
      return new Intl.DateTimeFormat(undefined, defaultOptions).format(d);
    } catch {
      return new Date(dateInput).toLocaleDateString();
    }
  }, [preferences.timezone]);

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        setTheme,
        toggleTheme,
        updatePreferences,
        formatCurrency,
        formatDate,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return ctx;
}
