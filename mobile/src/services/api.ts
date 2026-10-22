import { Platform } from 'react-native';

// Default backend URLs:
// - Android Emulator: 10.0.2.2 points to host machine localhost
// - iOS Simulator / Web: localhost points to host
// - Physical device: set to your machine's LAN IP (e.g. 192.168.1.xxx)
let customBackendUrl: string | null = null;

export const setBackendUrl = (url: string) => {
  customBackendUrl = url.trim().replace(/\/+$/, '');
};

export const getBackendUrl = (): string => {
  if (customBackendUrl) return customBackendUrl;
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000';
  }
  return 'http://localhost:4000';
};

let authToken: string | null = null;
let currentUser: any = null;

export const setAuthSession = (token: string | null, user: any) => {
  authToken = token;
  currentUser = user;
};

export const getAuthToken = () => authToken;
export const getCurrentUser = () => currentUser;

export const apiRequest = async (path: string, options: RequestInit = {}) => {
  const base = getBackendUrl();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }

  return data;
};
