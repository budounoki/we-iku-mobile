/**
 * 写真を1枚追加する流れ（撮影 or カメラロール → 整形 → 送信 → 一覧を更新）。
 * 月の画面・日の画面の両方から使う。
 */
import { useState } from 'react';
import { Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { uploadPhoto } from '../api/photoCalendar';
import { pickPhoto, PhotoPickerUnavailable } from '../lib/photo-picker';

/** サーバーは requestId に UUID を要求する（同じ送信の再試行を1枚として扱うため）。 */
function uuidV4(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += hex[(Math.random() * 4) | 8];
    else out += hex[(Math.random() * 16) | 0];
  }
  return out;
}

export function useAddPhoto() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const upload = async (babyId: number, date: string, source: 'camera' | 'library') => {
    try {
      const photo = await pickPhoto(source);
      if (!photo) return;
      setUploading(true);
      const requestId = uuidV4();
      const body = {
        requestId,
        photoDate: date,
        source: photo.source,
        takenAt: photo.takenAt,
        fullBase64: photo.fullBase64,
        thumbBase64: photo.thumbBase64,
      };
      try {
        await uploadPhoto(babyId, body);
      } catch {
        // 通信の瞬断に備えて同じ requestId で1回だけ再送（サーバー側で重複しない）。
        await uploadPhoto(babyId, body);
      }
      await queryClient.invalidateQueries({ queryKey: ['photo-month', babyId] });
      await queryClient.invalidateQueries({ queryKey: ['photo-day', babyId, date] });
    } catch (e) {
      Alert.alert(
        e instanceof PhotoPickerUnavailable ? 'アプリの更新が必要です' : '写真を保存できませんでした',
        e instanceof Error ? e.message : '時間をおいてもう一度お試しください。',
      );
    } finally {
      setUploading(false);
    }
  };

  /** 「撮影する／カメラロールから選ぶ」を選んでから追加する。 */
  const chooseAndUpload = (babyId: number, date: string) => {
    Alert.alert('写真を追加', undefined, [
      { text: '撮影する', onPress: () => void upload(babyId, date, 'camera') },
      { text: 'カメラロールから選ぶ', onPress: () => void upload(babyId, date, 'library') },
      { text: 'キャンセル', style: 'cancel' },
    ]);
  };

  return { uploading, upload, chooseAndUpload };
}
