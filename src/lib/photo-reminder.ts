/**
 * 写真のおしらせ（毎日の1枚カレンダー）のアプリ側処理。
 *
 * - Android: 専用の通知チャンネル photo_quiet（音なし・バイブ有り）を作る。
 *   他の通知のチャンネルには触れない。チャンネルの音・バイブは一度作ると
 *   アプリから変えられず、利用者の端末設定が優先される。
 * - 通知をタップしたら、その子・その日の写真画面を開き、開封を記録する。
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { createNavigationContainerRef } from '@react-navigation/native';
import { markPhotoReminderOpened } from '../api/photoCalendar';
import { apiPost } from '../api/client';

export const navigationRef = createNavigationContainerRef<any>();

export const PHOTO_CHANNEL_ID = 'photo_quiet';

export async function ensurePhotoQuietChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(PHOTO_CHANNEL_ID, {
      name: '写真のおしらせ',
      description: '毎日の1枚カレンダーのお知らせ（音なし）',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      enableVibrate: true,
      vibrationPattern: [0, 200],
      showBadge: false,
    });
  } catch {
    // 通知チャンネルが作れなくても他の機能には影響させない。
  }
}

export function isPhotoReminder(data: unknown): data is { type: 'photo_reminder'; notificationId: string; babyId: number; date: string } {
  return !!data && (data as any).type === 'photo_reminder';
}

let pending: { babyId: number; date: string } | null = null;

function tryNavigate() {
  if (!pending || !navigationRef.isReady()) return;
  const routes = navigationRef.getRootState()?.routeNames ?? [];
  if (!routes.includes('PhotoDay')) return; // ログイン前は、ログイン後に開く
  navigationRef.navigate('PhotoDay', pending);
  pending = null;
}

/** 通知タップ時。開封を記録し、写真の日の画面へ。 */
export async function handlePhotoReminderResponse(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data;
  if (!isPhotoReminder(data)) return;
  // 起動時の「最後にタップされた通知」は次回起動でも返ることがあるため、同じ通知は一度だけ扱う。
  const key = String(data.notificationId || response.notification.request.identifier);
  try {
    if ((await AsyncStorage.getItem('lastPhotoReminderHandled')) === key) return;
    await AsyncStorage.setItem('lastPhotoReminderHandled', key);
  } catch { /* 記録できなくても開く */ }
  if (data.notificationId) void markPhotoReminderOpened(String(data.notificationId)).catch(() => {});
  pending = { babyId: Number(data.babyId), date: String(data.date) };
  tryNavigate();
}

/** ナビゲーションの準備ができたとき・画面構成が変わったときに呼ぶ。 */
export function flushPendingPhotoReminder() {
  tryNavigate();
}

/**
 * OS の通知許可と端末登録（プッシュ通知トークンの送信）。通知をオンにするときに使う。
 * "denied" = 端末の設定で通知が許可されていない、"unavailable" = 許可はあるが
 * この端末ではプッシュ通知の登録ができなかった（通信エラーやアプリ側の設定不足）。
 */
export let lastPushError = '';
export async function ensurePushRegistered(): Promise<'ok' | 'denied' | 'unavailable'> {
  lastPushError = '';
  if (Platform.OS === 'web') return 'unavailable';
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';
  } catch {
    return 'denied';
  }
  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    if (!token) return 'unavailable';
    await apiPost('/api/auth/push-token', { token });
    return 'ok';
  } catch (e) {
    lastPushError = (e instanceof Error ? e.message : String(e)).slice(0, 160);
    return 'unavailable';
  }
}
