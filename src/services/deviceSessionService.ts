import { supabase } from '../supabaseClient';
import type { UserDeviceSession } from '../types';

const DEVICE_ID_KEY = 'apex_device_id';
const LOCAL_SESSION_KEY_PREFIX = 'apex_active_device_session_';

// ============================================================================
// Device Identification
// ============================================================================

/**
 * Returns a persistent unique identifier for this physical device/browser.
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      deviceId = `dev-${crypto.randomUUID()}`;
    } else {
      deviceId = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    }
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Parses user agent to produce a friendly device label
 * (e.g., "Windows PC (Chrome)", "MacBook (Safari)", "iPhone Mobile").
 */
export function getDeviceName(): string {
  const ua = navigator.userAgent;
  let os = 'Unknown Device';
  let browser = 'Browser';

  // Detect OS / Platform
  if (/iPad|iPhone|iPod/.test(ua)) {
    os = 'iPhone / iPad';
  } else if (/Android/.test(ua)) {
    os = 'Android Device';
  } else if (/Win/.test(ua)) {
    os = 'Windows PC';
  } else if (/Mac/.test(ua)) {
    os = 'Mac Computer';
  } else if (/Linux/.test(ua)) {
    os = 'Linux Workstation';
  }

  // Detect Browser
  if (/Edg/.test(ua)) {
    browser = 'Edge';
  } else if (/Chrome/.test(ua) && !/Edg/.test(ua)) {
    browser = 'Chrome';
  } else if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
    browser = 'Safari';
  } else if (/Firefox/.test(ua)) {
    browser = 'Firefox';
  }

  return `${os} (${browser})`;
}

export function getDevicePlatform(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Win/.test(ua)) return 'windows';
  if (/Mac/.test(ua)) return 'macos';
  if (/Linux/.test(ua)) return 'linux';
  return 'web';
}

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: string;
}

export function getCurrentDeviceInfo(): DeviceInfo {
  return {
    deviceId: getDeviceId(),
    deviceName: getDeviceName(),
    platform: getDevicePlatform(),
  };
}

// ============================================================================
// Single-Device Enforcement Engine
// ============================================================================

export interface DeviceSessionCheckResult {
  allowed: boolean;
  activeDeviceName?: string;
  activeDeviceId?: string;
  lastActive?: string;
  reason?: 'another_device_active' | 'session_superseded' | 'network_error';
}

/**
 * Validates whether this device is authorized to log in or use the account.
 * Rejects multi-device concurrent logins unless forceOverride is requested.
 */
export async function registerDeviceSession(
  userId: string,
  forceOverride = false
): Promise<DeviceSessionCheckResult> {
  const currentDeviceId = getDeviceId();
  const currentDeviceName = getDeviceName();
  const currentPlatform = getDevicePlatform();
  const now = new Date().toISOString();

  try {
    // 1. Fetch current active session from Supabase
    const { data: existingSession, error } = await supabase
      .from('user_device_sessions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('user_device_sessions table query error (fallback used):', error.message);
      // Fallback: check local storage representation
      return handleLocalSessionFallback(userId, currentDeviceId, currentDeviceName, forceOverride);
    }

    // 2. If an active session exists on another device
    if (existingSession && existingSession.active_device_id !== currentDeviceId) {
      if (!forceOverride) {
        // Multi-device login blocked!
        return {
          allowed: false,
          activeDeviceId: existingSession.active_device_id,
          activeDeviceName: existingSession.device_name || 'Another Device',
          lastActive: existingSession.last_active_at,
          reason: 'another_device_active',
        };
      }
    }

    // 3. Register or supersede session with this device
    const payload: UserDeviceSession = {
      user_id: userId,
      active_device_id: currentDeviceId,
      device_name: currentDeviceName,
      platform: currentPlatform,
      last_active_at: now,
    };

    const { error: upsertError } = await supabase
      .from('user_device_sessions')
      .upsert(payload);

    if (upsertError) {
      console.warn('Could not upsert user_device_sessions:', upsertError.message);
      return handleLocalSessionFallback(userId, currentDeviceId, currentDeviceName, forceOverride);
    }

    // Cache active status locally
    localStorage.setItem(
      `${LOCAL_SESSION_KEY_PREFIX}${userId}`,
      JSON.stringify(payload)
    );

    return { allowed: true };
  } catch (err) {
    console.warn('Network exception while verifying device session:', err);
    return handleLocalSessionFallback(userId, currentDeviceId, currentDeviceName, forceOverride);
  }
}

/**
 * Heartbeat check: Ensures this physical device is still the active session.
 * If another device has logged in and claimed the account, returns isValid: false.
 */
export async function checkDeviceSessionValidity(
  userId: string
): Promise<{ isValid: boolean; activeDeviceName?: string }> {
  const currentDeviceId = getDeviceId();

  try {
    const { data: session, error } = await supabase
      .from('user_device_sessions')
      .select('active_device_id, device_name, last_active_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !session) {
      return { isValid: true };
    }

    // If active_device_id has been changed to another device
    if (session.active_device_id !== currentDeviceId) {
      return {
        isValid: false,
        activeDeviceName: session.device_name || 'Another Device',
      };
    }

    // Heartbeat: update last_active_at in background (fire-and-forget)
    supabase
      .from('user_device_sessions')
      .update({ last_active_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('active_device_id', currentDeviceId)
      .then();

    return { isValid: true };
  } catch {
    return { isValid: true };
  }
}

/**
 * Revokes the device session upon user sign out.
 */
export async function terminateDeviceSession(userId: string): Promise<void> {
  const currentDeviceId = getDeviceId();

  try {
    await supabase
      .from('user_device_sessions')
      .delete()
      .eq('user_id', userId)
      .eq('active_device_id', currentDeviceId);
  } catch {
    // Ignore error on sign out
  }

  localStorage.removeItem(`${LOCAL_SESSION_KEY_PREFIX}${userId}`);
}

// ============================================================================
// Resilient Local Storage Fallback
// ============================================================================

function handleLocalSessionFallback(
  userId: string,
  currentDeviceId: string,
  currentDeviceName: string,
  forceOverride: boolean
): DeviceSessionCheckResult {
  const localRaw = localStorage.getItem(`${LOCAL_SESSION_KEY_PREFIX}${userId}`);
  if (localRaw) {
    try {
      const parsed: UserDeviceSession = JSON.parse(localRaw);
      if (parsed.active_device_id !== currentDeviceId && !forceOverride) {
        return {
          allowed: false,
          activeDeviceId: parsed.active_device_id,
          activeDeviceName: parsed.device_name || 'Another Browser/Device',
          lastActive: parsed.last_active_at,
          reason: 'another_device_active',
        };
      }
    } catch {
      // ignore parse error
    }
  }

  const payload: UserDeviceSession = {
    user_id: userId,
    active_device_id: currentDeviceId,
    device_name: currentDeviceName,
    platform: getDevicePlatform(),
    last_active_at: new Date().toISOString(),
  };

  localStorage.setItem(
    `${LOCAL_SESSION_KEY_PREFIX}${userId}`,
    JSON.stringify(payload)
  );

  return { allowed: true };
}
