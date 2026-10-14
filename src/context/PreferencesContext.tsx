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
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee (Rs / LKR)' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar (CA$)' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar (A$)' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen (¥)' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan (¥)' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar (S$)' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham (AED)' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal (SAR)' },
  { code: 'QAR', symbol: 'QAR', name: 'Qatari Riyal (QAR)' },
  { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar (KD)' },
  { code: 'OMR', symbol: 'OMR', name: 'Omani Rial (OMR)' },
  { code: 'BHD', symbol: 'BD', name: 'Bahraini Dinar (BD)' },
  { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee (PKR)' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka (BDT)' },
  { code: 'NPR', symbol: 'Rs', name: 'Nepalese Rupee (NPR)' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit (MYR)' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht (THB)' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah (IDR)' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso (PHP)' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong (VND)' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won (KRW)' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar (HK$)' },
  { code: 'TWD', symbol: 'NT$', name: 'New Taiwan Dollar (TWD)' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc (CHF)' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona (SEK)' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone (NOK)' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone (DKK)' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty (PLN)' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira (TRY)' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand (ZAR)' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real (BRL)' },
  { code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso (MXN)' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar (NZD)' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound (EGP)' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira (NGN)' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling (KES)' },
  { code: 'ILS', symbol: '₪', name: 'Israeli New Shekel (ILS)' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint (HUF)' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna (CZK)' },
];

export const COUNTRIES = [
  'Sri Lanka',
  'United States',
  'United Kingdom',
  'India',
  'Canada',
  'Australia',
  'Germany',
  'France',
  'Japan',
  'United Arab Emirates',
  'Saudi Arabia',
  'Qatar',
  'Kuwait',
  'Singapore',
  'Malaysia',
  'Thailand',
  'Indonesia',
  'Philippines',
  'Vietnam',
  'South Korea',
  'Pakistan',
  'Bangladesh',
  'Nepal',
  'Switzerland',
  'Sweden',
  'Norway',
  'Denmark',
  'Netherlands',
  'Spain',
  'Italy',
  'Poland',
  'Turkey',
  'South Africa',
  'Egypt',
  'Nigeria',
  'Kenya',
  'Brazil',
  'Mexico',
  'New Zealand',
  'Other',
];

export const TIMEZONES = [
  { id: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { id: 'Asia/Colombo', label: 'Sri Lanka Time (SLST - Colombo)' },
  { id: 'Asia/Kolkata', label: 'India Standard Time (IST - Mumbai, Delhi)' },
  { id: 'Asia/Karachi', label: 'Pakistan Standard Time (PKT - Karachi)' },
  { id: 'Asia/Dhaka', label: 'Bangladesh Standard Time (BST - Dhaka)' },
  { id: 'Asia/Kathmandu', label: 'Nepal Time (NPT - Kathmandu)' },
  { id: 'Asia/Dubai', label: 'Dubai, Abu Dhabi, Muscat (GST)' },
  { id: 'Asia/Riyadh', label: 'Riyadh, Doha, Kuwait (AST)' },
  { id: 'Asia/Singapore', label: 'Singapore, Kuala Lumpur (SGT / MYT)' },
  { id: 'Asia/Bangkok', label: 'Bangkok, Hanoi, Jakarta (ICT)' },
  { id: 'Asia/Manila', label: 'Manila (PHT)' },
  { id: 'Asia/Tokyo', label: 'Tokyo, Osaka (JST)' },
  { id: 'Asia/Seoul', label: 'Seoul (KST)' },
  { id: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
  { id: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { id: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { id: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { id: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { id: 'America/Toronto', label: 'Toronto, Montreal (EDT)' },
  { id: 'America/Sao_Paulo', label: 'São Paulo, Rio de Janeiro (BRT)' },
  { id: 'Europe/London', label: 'London, Dublin (GMT / BST)' },
  { id: 'Europe/Paris', label: 'Paris, Rome, Madrid, Berlin (CET)' },
  { id: 'Europe/Berlin', label: 'Berlin, Frankfurt, Amsterdam' },
  { id: 'Europe/Istanbul', label: 'Istanbul (TRT)' },
  { id: 'Australia/Sydney', label: 'Sydney, Melbourne, Canberra (AEST)' },
  { id: 'Pacific/Auckland', label: 'Auckland, Wellington (NZST)' },
  { id: 'Africa/Cairo', label: 'Cairo (EET)' },
  { id: 'Africa/Johannesburg', label: 'Johannesburg, Pretoria (SAST)' },
  { id: 'Africa/Lagos', label: 'Lagos, West Africa (WAT)' },
  { id: 'Africa/Nairobi', label: 'Nairobi, East Africa (EAT)' },
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

  // Always sync preferences from Supabase cloud profile
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.preferences) {
        setPreferences((prev) => {
          const synced = { ...prev, ...user.user_metadata.preferences };
          try {
            localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(synced));
          } catch {
            // ignore
          }
          return synced;
        });
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.user_metadata?.preferences) {
        setPreferences((prev) => {
          const synced = { ...prev, ...session.user.user_metadata.preferences };
          try {
            localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(synced));
          } catch {
            // ignore
          }
          return synced;
        });
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

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
