/**
 * 権限確認つきの写真（/api/photos/:id/image）を表示する。
 * 写真には公開 URL が無いため、ログイントークンを Authorization ヘッダーに付けて読む。
 */
import React, { useEffect, useState } from 'react';
import { Image, ImageStyle, StyleProp, View } from 'react-native';
import { photoImageSource } from '../api/photoCalendar';

export default function AuthPhoto({
  photoId,
  size,
  style,
  resizeMode = 'cover',
}: {
  photoId: string;
  size: 'thumb' | 'full';
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain';
}) {
  const [source, setSource] = useState<Awaited<ReturnType<typeof photoImageSource>> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    photoImageSource(photoId, size).then((s) => { if (alive) setSource(s); });
    return () => { alive = false; };
  }, [photoId, size]);

  if (!source || failed) return <View style={[style as any, { backgroundColor: '#F1ECF6' }]} />;
  return <Image source={source} style={style} resizeMode={resizeMode} onError={() => setFailed(true)} />;
}
