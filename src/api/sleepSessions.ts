import { apiGet, apiPost } from './client';

export interface SleepSession {
  id: number;
  familyId: string;
  childId?: number;
  createdBy: string;
  startedAt: string;
  endedAt?: string;
  durationMin?: number;
  settlingMethod?: string | null;
  settlingMinutes?: number | null;
  sleepLocation?: string | null;
}

export interface SettlingDetails {
  settlingMethod?: string;
  settlingMinutes?: number;
  sleepLocation?: string;
}

export function getActiveSleepSession(familyId: number | string): Promise<SleepSession | null> {
  return apiGet<SleepSession | null>(`/api/sleep-sessions/${familyId}/active`).catch(() => null);
}

export function getSleepSessions(familyId: number | string): Promise<SleepSession[]> {
  return apiGet<SleepSession[]>(`/api/sleep-sessions/${familyId}`).catch(() => []);
}

export function startSleepSession(data: {
  familyId: number | string;
  createdBy: string;
  childId?: number;
  /** 指定入眠時刻（ISO）。未指定ならサーバー側で「今」。 */
  startedAt?: string;
} & SettlingDetails): Promise<SleepSession> {
  return apiPost('/api/sleep-sessions/start', data);
}

export function endSleepSession(
  id: number,
  details?: SettlingDetails & { endedAt?: string },
): Promise<SleepSession> {
  return apiPost(`/api/sleep-sessions/${id}/end`, details ?? {});
}

/** 稼働中セッションの入眠時刻を訂正する。endedAt を渡すと起床時刻も確定できる
 *  （ただしタイムラインのログ生成は /end 側が行うため、起床確定は endSleepSession
 *  を使う。ここは入眠時刻のみの訂正に用いる）。 */
export function updateSleepTime(
  id: number,
  data: { startedAt: string; endedAt?: string },
): Promise<SleepSession> {
  return apiPost(`/api/sleep-sessions/${id}/update-time`, data);
}

export function manualSleepEntry(data: {
  familyId: number | string;
  createdBy: string;
  childId?: number;
  durationMin: number;
  startedAt: string;
} & SettlingDetails): Promise<SleepSession> {
  return apiPost('/api/sleep-sessions/manual', data);
}
