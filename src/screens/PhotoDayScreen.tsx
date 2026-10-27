/**
 * 毎日の1枚カレンダー（日の表示）— Web 版 PhotoDay.tsx のアプリ版。
 *
 * その日の写真一覧（タップで拡大）、「今日の1枚」（表紙）の選択、削除、
 * ひとことメモ・はじめての記念日の自動保存、写真の追加。
 * 編集できるのはママ・パパのみ（canEdit はサーバーが判定）。施設などは閲覧のみ。
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, TextInput, Switch, Modal, Alert,
  useWindowDimensions,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, ImagePlus, Star, Trash2, X } from 'lucide-react-native';
import { Text, Muted } from '../theme/ui';
import { palette } from '../theme/tokens';
import AuthPhoto from '../components/AuthPhoto';
import { useAddPhoto } from '../hooks/useAddPhoto';
import { deletePhoto, fetchPhotoDay, patchPhotoDay, type PhotoDay } from '../api/photoCalendar';

const ACCENT = '#7b4f9e';
const FIRST = '#ff8e7f';
type Draft = { memo: string; isFirst: boolean; firstLabel: string };
type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';

export default function PhotoDayScreen() {
  const route = useRoute<any>();
  const babyId: number = route.params.babyId;
  const date: string = route.params.date;
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const { uploading, upload } = useAddPhoto();

  const query = useQuery({ queryKey: ['photo-day', babyId, date], queryFn: () => fetchPhotoDay(babyId, date), retry: false });
  const day = query.data;
  const editable = !!day?.canEdit;

  const [busy, setBusy] = useState(false);
  const [enlarged, setEnlarged] = useState<string | null>(null);

  // ── ひとこと・はじめての自動保存（入力が止まって約0.85秒後に保存） ──
  const [draft, setDraft] = useState<Draft>({ memo: '', isFirst: false, firstLabel: '' });
  const [status, setStatus] = useState<SaveStatus>('saved');
  const savedRef = useRef<string>('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedFor = useRef<string | null>(null);
  const latest = useRef<Draft>(draft);

  useEffect(() => {
    if (!day || loadedFor.current === `${babyId}:${date}`) return;
    loadedFor.current = `${babyId}:${date}`;
    const initial = { memo: day.memo || '', isFirst: day.isFirst, firstLabel: day.firstLabel || '' };
    savedRef.current = JSON.stringify(initial);
    latest.current = initial;
    setDraft(initial);
  }, [day, babyId, date]);

  const save = async () => {
    const value = latest.current;
    const snapshot = JSON.stringify(value);
    if (snapshot === savedRef.current) { setStatus('saved'); return; }
    setStatus('saving');
    try {
      await patchPhotoDay(babyId, date, value);
      savedRef.current = snapshot;
      setStatus(JSON.stringify(latest.current) === snapshot ? 'saved' : 'pending');
      queryClient.setQueryData<PhotoDay>(['photo-day', babyId, date], (old) => (old ? { ...old, ...value } : old));
      void queryClient.invalidateQueries({ queryKey: ['photo-month', babyId] });
    } catch {
      setStatus('error');
    }
  };

  const update = (patch: Partial<Draft>) => {
    if (!editable) return;
    const value = { ...latest.current, ...patch };
    latest.current = value;
    setDraft(value);
    setStatus('pending');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 850);
  };

  // 画面を離れるときに未保存の入力があれば保存しておく。
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (JSON.stringify(latest.current) !== savedRef.current) void patchPhotoDay(babyId, date, latest.current).catch(() => {});
  }, [babyId, date]);

  const mutate = async (action: () => Promise<unknown>, failMessage: string) => {
    setBusy(true);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ['photo-day', babyId, date] });
      await queryClient.invalidateQueries({ queryKey: ['photo-month', babyId] });
    } catch (e) {
      Alert.alert(failMessage, e instanceof Error ? e.message : '時間をおいてもう一度お試しください。');
    } finally {
      setBusy(false);
    }
  };

  const [y, m, d] = date.split('-').map(Number);
  const tile = Math.floor((Math.min(width, 520) - 32 - 10) / 2);

  if (query.isLoading) return <View style={s.center}><ActivityIndicator color={palette.primary} /></View>;
  if (query.error || !day) {
    return (
      <View style={s.center}>
        <Text style={s.emptyTitle}>写真を読み込めませんでした</Text>
        <Muted style={s.emptyText}>{query.error instanceof Error ? query.error.message : ''}</Muted>
        <TouchableOpacity style={[s.secondary, { marginTop: 16, paddingHorizontal: 24 }]} onPress={() => void query.refetch()}>
          <Text style={s.secondaryText}>もう一度試す</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={s.page}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={s.title}>{y}年{m}月{d}日</Text>

        {!day.photos.length ? (
          <View style={s.emptyCard}>
            <Camera size={26} color={ACCENT} />
            <Text style={s.emptyTitle}>残したいときに、1枚。</Text>
            <Muted style={s.emptyText}>何気ない日も、特別な日も。{'\n'}写真はあとから、いつでも追加できます。</Muted>
          </View>
        ) : (
          <View style={s.album}>
            {day.photos.map((photo) => {
              const isCover = day.coverPhotoId === photo.id;
              return (
                <View key={photo.id} style={[s.tileWrap, { width: tile }]}>
                  <TouchableOpacity onPress={() => setEnlarged(photo.id)} accessibilityLabel="写真を拡大">
                    <AuthPhoto photoId={photo.id} size="thumb" style={[s.tileImg, { width: tile, height: tile }]} />
                  </TouchableOpacity>
                  <View style={s.tileRow}>
                    {editable ? (
                      <TouchableOpacity
                        style={[s.coverBtn, isCover && s.coverBtnOn]}
                        disabled={busy || isCover}
                        onPress={() => void mutate(() => patchPhotoDay(babyId, date, { coverPhotoId: photo.id }), '表紙を変更できませんでした')}
                      >
                        <Star size={13} color={isCover ? '#fff' : ACCENT} fill={isCover ? '#fff' : 'none'} />
                        <Text style={[s.coverText, isCover && { color: '#fff' }]}>{isCover ? '今日の1枚' : '表紙にする'}</Text>
                      </TouchableOpacity>
                    ) : (
                      <Muted style={{ fontSize: 12 }}>{isCover ? '今日の1枚' : '写真'}</Muted>
                    )}
                    {editable && (
                      <TouchableOpacity
                        disabled={busy}
                        accessibilityLabel="この写真を削除"
                        onPress={() => Alert.alert('この写真を削除しますか？', 'この操作は取り消せません。', [
                          { text: 'キャンセル', style: 'cancel' },
                          { text: '削除する', style: 'destructive', onPress: () => void mutate(() => deletePhoto(photo.id), '削除できませんでした') },
                        ])}
                        style={s.iconBtn}
                      >
                        <Trash2 size={17} color="#B4534A" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={s.card}>
          <Text style={s.label}>この日のひとこと</Text>
          <TextInput
            style={s.memo}
            multiline
            maxLength={2000}
            value={draft.memo}
            editable={editable}
            placeholder={editable ? '笑ったこと、気づいたこと。ひとことでも。' : 'この日のメモ'}
            placeholderTextColor={palette.mutedForeground}
            onChangeText={(memo) => update({ memo })}
          />
          <View style={s.firstRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Star size={17} color={FIRST} />
              <Text style={s.label}>はじめての記念日</Text>
            </View>
            <Switch value={draft.isFirst} disabled={!editable} onValueChange={(isFirst) => update({ isFirst })} trackColor={{ true: FIRST }} />
          </View>
          {draft.isFirst && (
            <TextInput
              style={s.input}
              maxLength={100}
              value={draft.firstLabel}
              editable={editable}
              placeholder="例：寝返り"
              placeholderTextColor={palette.mutedForeground}
              onChangeText={(firstLabel) => update({ firstLabel })}
            />
          )}
          {editable ? (
            <Muted style={[s.status, status === 'error' && { color: '#B4534A' }]}>
              {status === 'saved' ? '自動保存しました' : status === 'saving' ? '保存しています…'
                : status === 'error' ? 'まだ保存できていません。通信を確認してください。' : '変更を保存します…'}
            </Muted>
          ) : (
            <Muted style={s.status}>メモ・記念日・今日の1枚は、保護者が編集できます。</Muted>
          )}
          {status === 'error' && (
            <TouchableOpacity onPress={() => void save()}><Text style={s.link}>もう一度保存する</Text></TouchableOpacity>
          )}
        </View>

        {editable && (
          <>
            <TouchableOpacity style={[s.primary, uploading && { opacity: 0.6 }]} disabled={uploading} onPress={() => void upload(babyId, date, 'camera')}>
              {uploading ? <ActivityIndicator color="#fff" /> : <Camera size={18} color="#fff" />}
              <Text style={s.primaryText}>{uploading ? '保存しています…' : '撮影する'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.secondary} disabled={uploading} onPress={() => void upload(babyId, date, 'library')}>
              <ImagePlus size={18} color={ACCENT} />
              <Text style={s.secondaryText}>カメラロールから選ぶ</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <Modal visible={!!enlarged} transparent animationType="fade" onRequestClose={() => setEnlarged(null)}>
        <View style={s.viewer}>
          <TouchableOpacity style={s.viewerClose} onPress={() => setEnlarged(null)} accessibilityLabel="拡大写真を閉じる">
            <X size={26} color="#fff" />
          </TouchableOpacity>
          {enlarged && <AuthPhoto photoId={enlarged} size="full" style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFF9F2' },
  content: { padding: 16, paddingBottom: 48, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#FFF9F2' },
  title: { fontSize: 22, fontWeight: '900', color: palette.foreground },
  emptyCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#F0E6DA' },
  emptyTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  album: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tileWrap: { gap: 6 },
  tileImg: { borderRadius: 14 },
  tileRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  coverBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#E8DDF2', backgroundColor: '#fff' },
  coverBtnOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  coverText: { fontSize: 12, fontWeight: '700', color: ACCENT },
  iconBtn: { padding: 6 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, gap: 10, borderWidth: 1, borderColor: '#F0E6DA' },
  label: { fontSize: 14, fontWeight: '700', color: palette.foreground },
  memo: { minHeight: 84, borderWidth: 1, borderColor: '#E8E5EB', borderRadius: 12, padding: 12, fontSize: 15, color: palette.foreground, textAlignVertical: 'top' },
  input: { borderWidth: 1, borderColor: '#E8E5EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: palette.foreground },
  firstRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: { fontSize: 12 },
  link: { fontSize: 13, color: ACCENT, fontWeight: '700' },
  primary: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 15 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondary: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 14, paddingVertical: 13, borderWidth: 1, borderColor: '#E8DDF2' },
  secondaryText: { color: ACCENT, fontSize: 15, fontWeight: '700' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerClose: { position: 'absolute', top: 54, right: 20, padding: 8, zIndex: 2 },
});
