/**
 * 毎日の1枚カレンダー（写真カレンダー）API — Web 版と同じサーバー API を使う。
 *
 * サーバーは Bearer トークンをセッションに変換するため、アプリのログインのまま
 * 利用できる（書き込み系の同一オリジン確認も Bearer は対象外）。
 * 写真は権限確認つきの /api/photos/:id/image からのみ取得でき、公開 URL は無い。
 * そのため画像も Authorization ヘッダーを付けて読み込む（photoImageSource）。
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiGet, apiRequest, getBaseUrl } from './client';

export type PhotoChild = { id: number; name: string; birthday: string | null; canEdit: boolean };
export type PhotoContext = { children: PhotoChild[]; canNotify: boolean };
export type Photo = { id: string; photoDate: string; takenAt: string | null; source: string };
export type PhotoDay = {
  date: string;
  photos: Photo[];
  coverPhotoId: string | null;
  memo: string;
  isFirst: boolean;
  firstLabel: string;
  canEdit: boolean;
};
export type PhotoMonth = {
  canEdit: boolean;
  days: { date: string; coverPhotoId: string | null; isFirst: boolean }[];
};
export type PhotoUpload = {
  requestId: string;
  photoDate: string;
  source: 'camera' | 'library';
  takenAt: string | null;
  fullBase64: string;
  thumbBase64: string;
};

/** 日本時間の今日（YYYY-MM-DD）。端末のタイムゾーンに関係なく JST。 */
export function jstToday(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function fetchPhotoContext(): Promise<PhotoContext> {
  return apiGet<PhotoContext>('/api/photo-calendar/context');
}

export function fetchPhotoMonth(babyId: number, month: string): Promise<PhotoMonth> {
  return apiGet<PhotoMonth>(`/api/photo-calendar/${babyId}?month=${month}`);
}

export function fetchPhotoDay(babyId: number, date: string): Promise<PhotoDay> {
  return apiGet<PhotoDay>(`/api/photo-calendar/${babyId}/day/${date}`);
}

export async function uploadPhoto(babyId: number, input: PhotoUpload): Promise<{ id: string; photoDate: string }> {
  const res = await apiRequest('POST', `/api/photo-calendar/${babyId}/photos`, input);
  return res.json();
}

export async function patchPhotoDay(
  babyId: number,
  date: string,
  patch: Partial<{ coverPhotoId: string; memo: string; isFirst: boolean; firstLabel: string }>,
): Promise<void> {
  await apiRequest('PATCH', `/api/photo-calendar/${babyId}/day/${date}`, patch);
}

export async function deletePhoto(photoId: string): Promise<void> {
  await apiRequest('DELETE', `/api/photos/${photoId}`);
}

/** 権限確認つき画像の読み込み元（Authorization ヘッダー付き）。 */
export async function photoImageSource(photoId: string, size: 'thumb' | 'full') {
  const token = await AsyncStorage.getItem('sessionToken');
  return {
    uri: `${getBaseUrl()}/api/photos/${photoId}/image?size=${size}`,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  };
}
