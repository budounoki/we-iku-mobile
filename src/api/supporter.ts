import { apiGet, apiPost, apiRequest } from './client';

/**
 * サポーター（ぶどうの木）管理 — 親側 API。
 *
 * Web 版 client/src/lib/supporter.ts と同じ型・同じ日時の扱いに合わせている。
 * サーバーの /api/supporter/* は req.session.userId で利用者を判定するが、
 * mobileAuthMiddleware が Bearer トークンから session.userId を埋めるため、
 * アプリの既存トークン認証のままで利用できる。
 */

export type SupporterStatus = {
  enabled: boolean;
  authenticated: boolean;
  canManage: boolean;
  isSupporter: boolean;
  displayName?: string;
  message?: string;
};

export type SupporterManageChild = { id: number; name: string; birthday: string };

export type SupporterInvitation = {
  id: number;
  childId: number;
  childName: string;
  recipientAddress: string;
  displayName: string;
  startsAt: string;
  endsAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
};

export type SupporterManageResponse = {
  children: SupporterManageChild[];
  invitations: SupporterInvitation[];
};

export type SupporterInvitationState = '受け入れ待ち' | '受け入れ済み' | '期限切れ' | '取り消し済み';

export function supporterInvitationState(
  invitation: Pick<SupporterInvitation, 'startsAt' | 'endsAt' | 'acceptedAt' | 'revokedAt'>,
  now: string = new Date().toISOString(),
): SupporterInvitationState {
  if (invitation.revokedAt) return '取り消し済み';
  if (Date.parse(invitation.endsAt) <= Date.parse(now)) return '期限切れ';
  if (invitation.acceptedAt) return '受け入れ済み';
  return '受け入れ待ち';
}

/** 表示用: 2026/10/14 21:08（端末のタイムゾーンに関係なく JST）。 */
export function jstDateTime(value: string): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(value));
}

/** ISO → JST の年月日時分（ピッカーの初期値用）。 */
export function toJstParts(value: string): { date: string; time: string } {
  if (!value) return { date: '', time: '' };
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value)).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/**
 * JST として入力された日付・時刻を ISO に変換する。
 * 端末のタイムゾーンに依存しないよう、明示的に +09:00 を付ける。
 */
export function fromJstParts(date: string, time: string): string {
  return new Date(`${date}T${time}:00+09:00`).toISOString();
}

export function fetchSupporterStatus(): Promise<SupporterStatus> {
  return apiGet<SupporterStatus>('/api/supporter/status');
}

export function fetchSupporterManage(): Promise<SupporterManageResponse> {
  return apiGet<SupporterManageResponse>('/api/supporter/manage');
}

export function createSupporterInvitation(input: {
  childId: number;
  recipientAddress: string;
  startsAt: string;
  endsAt: string;
}): Promise<SupporterInvitation> {
  return apiPost<SupporterInvitation>('/api/supporter/invitations', input);
}

export async function extendSupporterInvitation(id: number, endsAt: string): Promise<void> {
  await apiRequest('PATCH', `/api/supporter/invitations/${id}`, { endsAt });
}

export async function revokeSupporterInvitation(id: number): Promise<void> {
  await apiRequest('POST', `/api/supporter/invitations/${id}/revoke`);
}
