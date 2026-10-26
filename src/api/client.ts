import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// In production, point to your deployed backend URL
// In dev, point to your local machine (use your LAN IP, not localhost)
export function getBaseUrl(): string {
  // Explicit env var wins on every platform — set EXPO_PUBLIC_API_URL to the
  // backend (e.g. http://localhost:3000 for local dev, or your public URL).
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Fallback: same-origin (requires dev-proxy on the served port).
    return window.location.origin;
  }

  return 'http://localhost:3000';
}

const BASE_URL = getBaseUrl();

export async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const familyId = await AsyncStorage.getItem('familyId');
  const sessionToken = await AsyncStorage.getItem('sessionToken');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;
  if (familyId) headers['X-Family-Id'] = familyId;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(errorMessageFrom(res.status, res.statusText, text));
  }

  return res;
}

/**
 * エラー応答から利用者に見せる文言だけを取り出す。
 *
 * サーバーは {"message":"..."} を返すため、本文をそのまま Error.message に
 * 入れると画面に `400: {"message":"..."}` と JSON がそのまま出てしまう
 * （client 2026-10: エラー表示のスタイルがおかしい）。
 */
function errorMessageFrom(status: number, statusText: string, body: string): string {
  const trimmed = body.trim();
  if (trimmed && !trimmed.startsWith('<')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        const value = (parsed as Record<string, unknown>).message
          ?? (parsed as Record<string, unknown>).error;
        if (typeof value === 'string' && value.trim()) return value.trim();
      }
    } catch {
      return trimmed;
    }
  }
  return `${status}: ${statusText || 'エラーが発生しました'}`;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiRequest('GET', path);
  return res.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiRequest('POST', path, body);
  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  await apiRequest('DELETE', path);
}
