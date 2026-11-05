/**
 * 毎日の1枚カレンダー（月の表示）— Web 版 client/src/pages/photo-calendar/PhotoCalendar.tsx のアプリ版。
 *
 * 月ごとのカレンダーに、その日の「今日の1枚」をサムネイルで並べる。日付をタップで
 * その日の画面へ。誕生日より前の日は押せない。はじめての記念日には印を付ける。
 * 表示できるか・誰が編集できるかはすべてサーバー（/api/photo-calendar/*）が判定する。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, useWindowDimensions, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, ChevronLeft, ChevronRight, Star } from 'lucide-react-native';
import { Text, Muted } from '../theme/ui';
import { palette, radius } from '../theme/tokens';
import { useChildStore } from '../store/childStore';
import { useAuthStore } from '../store/authStore';
import { isGuestSession, rememberGuestFamily } from '../lib/guest-upgrade';
import AuthPhoto from '../components/AuthPhoto';
import { useAddPhoto } from '../hooks/useAddPhoto';
import { fetchPhotoContext, fetchPhotoMonth, jstToday } from '../api/photoCalendar';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const ACCENT = '#7b4f9e';
const FIRST = '#ff8e7f';

function monthOffset(month: string, offset: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function PhotoCalendarScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { activeChildId } = useChildStore();
  const { width } = useWindowDimensions();
  const { uploading, chooseAndUpload } = useAddPhoto();

  const today = jstToday();
  const [month, setMonth] = useState<string>(route.params?.month || today.slice(0, 7));
  const [pickedChildId, setPickedChildId] = useState<number | null>(route.params?.babyId ?? null);

  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();
  // ゲスト（アカウント無し）は本人確認ができないため写真カレンダーを使えない。ログインを案内する。
  const [guest, setGuest] = useState<boolean | null>(null);
  useEffect(() => { void isGuestSession().then(setGuest); }, []);

  const context = useQuery({
    queryKey: ['photo-context'],
    queryFn: fetchPhotoContext,
    retry: false,
    staleTime: 30_000,
    enabled: guest === false,
  });

  const startLogin = () => {
    Alert.alert(
      'ログインして写真カレンダーを使う',
      'LINE・Google・Appleのいずれかでログインしてください。いまの赤ちゃんの情報や記録は、そのまま引き継がれます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ログインへ進む',
          onPress: async () => {
            if (user?.familyId) await rememberGuestFamily(user.familyId, user.role);
            await logout();
            useChildStore.getState().setChildren([]);
            queryClient.clear();
          },
        },
      ],
    );
  };
  const children = context.data?.children ?? [];
  const child =
    children.find((c) => c.id === pickedChildId) ||
    children.find((c) => c.id === activeChildId) ||
    children[0];

  const floor = child?.birthday?.slice(0, 7);
  const shownMonth = floor && month < floor ? floor : month;
  const monthQuery = useQuery({
    queryKey: ['photo-month', child?.id, shownMonth],
    queryFn: () => fetchPhotoMonth(child!.id, shownMonth),
    enabled: !!child,
    retry: false,
  });

  const byDate = useMemo(() => new Map((monthQuery.data?.days ?? []).map((d) => [d.date, d])), [monthQuery.data]);
  const [y, m] = shownMonth.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const cell = Math.floor((Math.min(width, 520) - 32 - 6 * 4) / 7);

  const openDay = (date: string) => navigation.navigate('PhotoDay', { babyId: child!.id, date });

  if (guest) {
    return (
      <View style={s.center}>
        <Camera size={30} color={ACCENT} />
        <Text style={[s.emptyTitle, { marginTop: 10 }]}>写真カレンダーはログインして使えます</Text>
        <Muted style={s.emptyText}>
          大切な写真を家族だけで安全に残すため、LINE・Google・Appleのアカウントでのログインが必要です。{'\n'}
          いまの赤ちゃんの情報や記録は、そのまま引き継がれます。
        </Muted>
        <TouchableOpacity style={[s.primary, { alignSelf: 'stretch', marginTop: 18 }]} onPress={startLogin}>
          <Text style={s.primaryText}>ログインして使う</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (guest === null || context.isLoading) {
    return <View style={s.center}><ActivityIndicator color={palette.primary} /></View>;
  }
  if (context.error || !child) {
    const msg = context.error instanceof Error ? context.error.message : '';
    return (
      <View style={s.center}>
        <Text style={s.emptyTitle}>{!child && !context.error ? '赤ちゃんの登録がまだありません' : '写真カレンダーを開けません'}</Text>
        <Muted style={s.emptyText}>
          {!child && !context.error ? 'プロフィールを登録すると、写真を残せます。' : msg || '時間をおいてもう一度お試しください。'}
        </Muted>
        {/* ログインの有効期限切れ（古いログイン情報）のときは、ログインし直してもらう。 */}
        {msg.includes('ログイン') && (
          <TouchableOpacity style={[s.primary, { alignSelf: 'stretch', marginTop: 18 }]} onPress={startLogin}>
            <Text style={s.primaryText}>ログインし直す</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const canEdit = child.canEdit;
  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Text style={s.eyebrow}>日々を、少しずつ。</Text>
      <Text style={s.title}>毎日の1枚カレンダー</Text>
      <Muted style={s.lead}>撮れた日も、撮らない日も。あなたのペースで。</Muted>

      {children.length > 1 && (
        <View style={s.chipRow}>
          {children.map((c) => {
            const on = c.id === child.id;
            return (
              <TouchableOpacity key={c.id} style={[s.chip, on && s.chipOn]} onPress={() => setPickedChildId(c.id)}>
                <Text style={[s.chipText, on && s.chipTextOn]}>{c.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={s.card}>
        <View style={s.monthRow}>
          <TouchableOpacity
            style={s.navBtn}
            disabled={!!floor && shownMonth <= floor}
            onPress={() => setMonth(monthOffset(shownMonth, -1))}
            accessibilityLabel="前の月"
          >
            <ChevronLeft size={22} color={!!floor && shownMonth <= floor ? '#ccc' : ACCENT} />
          </TouchableOpacity>
          <Text style={s.monthTitle}>{y}年 {m}月</Text>
          <TouchableOpacity style={s.navBtn} onPress={() => setMonth(monthOffset(shownMonth, 1))} accessibilityLabel="次の月">
            <ChevronRight size={22} color={ACCENT} />
          </TouchableOpacity>
        </View>

        <View style={s.grid}>
          {WEEKDAYS.map((w) => <Text key={w} style={[s.weekday, { width: cell }]}>{w}</Text>)}
          {Array.from({ length: offset }, (_, i) => <View key={`pad${i}`} style={{ width: cell, height: cell }} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const date = `${shownMonth}-${String(i + 1).padStart(2, '0')}`;
            const day = byDate.get(date);
            const isToday = date === today;
            const disabled = (!!child.birthday && date < child.birthday.slice(0, 10)) || date > today;
            return (
              <TouchableOpacity
                key={date}
                disabled={disabled}
                onPress={() => openDay(date)}
                style={[s.cell, { width: cell, height: cell }, isToday && s.today, disabled && { opacity: 0.35 }]}
                accessibilityLabel={`${m}月${i + 1}日の写真${day?.isFirst ? '、はじめて' : ''}`}
              >
                {day?.coverPhotoId && <AuthPhoto photoId={day.coverPhotoId} size="thumb" style={StyleSheet.absoluteFill} />}
                <Text style={[s.dayNum, day?.coverPhotoId && s.dayNumOnPhoto]}>{i + 1}</Text>
                {day?.isFirst && <View style={s.firstDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
        {monthQuery.isLoading && <ActivityIndicator style={{ marginTop: 8 }} color={palette.primary} />}

        <View style={s.legendRow}>
          <View style={s.legend}><View style={[s.firstDot, { position: 'relative', top: 0, right: 0 }]} /><Muted style={s.legendText}>はじめての記念日</Muted></View>
          <TouchableOpacity onPress={() => setMonth(today.slice(0, 7))}><Text style={s.link}>今月へ</Text></TouchableOpacity>
        </View>
      </View>

      {canEdit && (
        <TouchableOpacity style={[s.primary, uploading && { opacity: 0.6 }]} disabled={uploading} onPress={() => chooseAndUpload(child.id, today)}>
          {uploading ? <ActivityIndicator color="#fff" /> : <Camera size={18} color="#fff" />}
          <Text style={s.primaryText}>{uploading ? '保存しています…' : '今日の1枚を残す'}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={s.secondary} onPress={() => openDay(today)}>
        <Star size={16} color={ACCENT} />
        <Text style={s.secondaryText}>今日の写真を見る</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFF9F2' },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#FFF9F2' },
  eyebrow: { fontSize: 12, color: ACCENT, fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 22, fontWeight: '900', color: palette.foreground },
  lead: { fontSize: 13 },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  chipOn: { backgroundColor: palette.primary, borderColor: palette.primary },
  chipText: { fontSize: 14, color: palette.foreground },
  chipTextOn: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 12, borderWidth: 1, borderColor: '#F0E6DA' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  navBtn: { padding: 8 },
  monthTitle: { fontSize: 17, fontWeight: '800', color: palette.foreground },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-start' },
  weekday: { textAlign: 'center', fontSize: 11, color: palette.mutedForeground, paddingVertical: 4 },
  cell: { borderRadius: 10, backgroundColor: '#FBF6F0', overflow: 'hidden', alignItems: 'flex-start', justifyContent: 'flex-start' },
  today: { borderWidth: 2, borderColor: ACCENT },
  dayNum: { fontSize: 11, color: palette.foreground, margin: 4, fontWeight: '700' },
  dayNumOnPhoto: { color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  firstDot: { position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: 4, backgroundColor: FIRST },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 12 },
  link: { fontSize: 13, color: ACCENT, fontWeight: '700' },
  primary: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 15, marginTop: 6 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondary: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 14, paddingVertical: 13, borderWidth: 1, borderColor: '#E8DDF2' },
  secondaryText: { color: ACCENT, fontSize: 15, fontWeight: '700' },
});
