/**
 * サポーター管理（親側）— Web の client/src/pages/SupporterManage.tsx のアプリ版。
 *
 * 施設などのサポーターに、お子さまの記録を期間限定で共有する招待を作成・管理する。
 * サーバー API（/api/supporter/*）は Web と共通で、mobileAuthMiddleware が
 * Bearer トークンから session を埋めるため、アプリのログインのまま利用できる。
 *
 * 招待URLや新しいログインは発行しない。施設側で確認済みの既存共通アカウントを
 * PUBLIC CODE で指定する方式（Web と同じ）。日時はすべて JST。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, Card, Button, Text, Title, Muted } from '../theme/ui';
import { palette, radius } from '../theme/tokens';
import DatePickerModal from '../components/DatePickerModal';
import ScrollTimePicker from '../components/ScrollTimePicker';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import {
  SupporterInvitation,
  SupporterManageResponse,
  SupporterStatus,
  createSupporterInvitation,
  extendSupporterInvitation,
  fetchSupporterManage,
  fetchSupporterStatus,
  fromJstParts,
  jstDateTime,
  revokeSupporterInvitation,
  supporterInvitationState,
  toJstParts,
} from '../api/supporter';

/** 今（JST）を日付・時刻に分解したもの。 */
function nowJst() {
  return toJstParts(new Date().toISOString());
}

/** 既定の終了日時: 開始の翌日（Web は空欄必須だが、アプリでは入力を減らす）。 */
function nextDayJst() {
  return toJstParts(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
}

type PickerTarget = 'startDate' | 'startTime' | 'endDate' | 'endTime' | 'extendDate' | 'extendTime' | null;

export default function SupporterManageScreen() {
  const navigation = useNavigation<any>();
  const kbHeight = useKeyboardHeight();
  const scrollRef = useRef<ScrollView>(null);

  const [status, setStatus] = useState<SupporterStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SupporterManageResponse | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const [childId, setChildId] = useState<number | null>(null);
  const [recipientCode, setRecipientCode] = useState('');
  const [start, setStart] = useState(nowJst);
  const [end, setEnd] = useState(nextDayJst);

  const [extendId, setExtendId] = useState<number | null>(null);
  const [extendAt, setExtendAt] = useState({ date: '', time: '' });
  const [picker, setPicker] = useState<PickerTarget>(null);

  // 状態（受け入れ待ち/期限切れ等）は時間で変わるので定期的に再評価する。
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  /**
   * エラーは画面上部に表示されるが、「招待を作成」はフォーム下端にあるため、
   * 押した位置からはメッセージが画面外で見えない。設定時に必ず先頭まで
   * スクロールして気付けるようにする
   * （client 2026-10: 招待を作成を押してもメッセージが見えない）。
   */
  const showError = useCallback((message: string) => {
    setError(message);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
  }, []);

  const load = useCallback(async () => {
    try {
      setData(await fetchSupporterManage());
      setError('');
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : '管理情報を取得できません。');
    }
  }, [showError]);

  useEffect(() => {
    (async () => {
      try {
        const next = await fetchSupporterStatus();
        setStatus(next);
        if (next.enabled && next.authenticated && next.canManage) await load();
      } catch (caught) {
        showError(caught instanceof Error ? caught.message : '利用状態を確認できません。');
      } finally {
        setLoading(false);
      }
    })();
  }, [load, showError]);

  const create = async () => {
    if (!childId || !recipientCode.trim()) {
      showError('お子さまと PUBLIC CODE を入力してください。');
      return;
    }
    const startsAt = fromJstParts(start.date, start.time);
    const endsAt = fromJstParts(end.date, end.time);
    if (Date.parse(startsAt) >= Date.parse(endsAt)) {
      showError('終了日時は開始日時より後にしてください。');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createSupporterInvitation({
        childId,
        recipientAddress: recipientCode.trim(),
        startsAt,
        endsAt,
      });
      setChildId(null);
      setRecipientCode('');
      setStart(nowJst());
      setEnd(nextDayJst());
      await load();
      Alert.alert('招待を作成しました', 'サポーターが受け入れると記録を共有できます。');
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : '招待を作成できませんでした。');
    } finally {
      setSaving(false);
    }
  };

  const submitExtend = async () => {
    if (!extendId) return;
    const invitation = data?.invitations.find((item) => item.id === extendId);
    const nextEnd = fromJstParts(extendAt.date, extendAt.time);
    if (invitation && Date.parse(nextEnd) <= Date.parse(invitation.endsAt)) {
      showError('終了日時は現在の終了日時より後にしてください。');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await extendSupporterInvitation(extendId, nextEnd);
      setExtendId(null);
      await load();
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : '期限を更新できませんでした。');
    } finally {
      setSaving(false);
    }
  };

  const revoke = (id: number) => {
    Alert.alert('取り消しますか？', 'この招待・利用権限を取り消します。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '取り消す',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          setError('');
          try {
            await revokeSupporterInvitation(id);
            await load();
          } catch (caught) {
            showError(caught instanceof Error ? caught.message : '取り消しできませんでした。');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const nowIso = useMemo(() => new Date(now).toISOString(), [now]);

  if (loading) {
    return (
      <Screen>
        <View style={s.center}><ActivityIndicator size="large" color={palette.primary} /></View>
      </Screen>
    );
  }

  // 機能が無効 / 権限が無い場合は、その理由だけを出して操作UIは見せない。
  if (!status?.enabled || !status?.authenticated || !status?.canManage) {
    return (
      <Screen contentStyle={s.content}>
        <Card style={s.card}>
          <Title style={s.cardTitle}>サポーター管理</Title>
          <Muted style={s.note}>
            {!status?.enabled
              ? (status?.message || 'サポーター機能は現在利用できません。')
              : !status?.authenticated
                ? 'ログインしてからご利用ください。'
                : 'この機能はパパ・ママのアカウントでご利用いただけます。'}
          </Muted>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={s.content} scrollRef={scrollRef}>
      <Muted style={s.lead}>
        招待URLや新しいログインの発行は行いません。施設側で確認済みの既存共通アカウントを
        PUBLIC CODE で指定します。日時はすべて JST です。
      </Muted>

      {!!error && <Text style={s.error}>{error}</Text>}

      {/* ── サポーターを招待 ─────────────────────────────────────────── */}
      <Card style={s.card}>
        <Title style={s.cardTitle}>サポーターを招待</Title>

        <Text style={s.label}>お子さま</Text>
        {!data?.children.length ? (
          <Muted style={s.note}>お子さまが登録されていません。</Muted>
        ) : (
          <View style={s.chipRow}>
            {data.children.map((child) => {
              const on = childId === child.id;
              return (
                <TouchableOpacity
                  key={child.id}
                  style={[s.chip, on && s.chipOn]}
                  onPress={() => setChildId(on ? null : child.id)}
                >
                  <Text style={[s.chipText, on && s.chipTextOn]}>{child.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={s.label}>施設アカウントの公開コード（PUBLIC CODE）</Text>
        <TextInput
          style={s.input}
          value={recipientCode}
          onChangeText={setRecipientCode}
          placeholder="施設から受け取った PUBLIC CODE"
          placeholderTextColor={palette.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />
        <Muted style={s.hint}>
          施設の既存共通アカウントに表示されるコードです。メールアドレスや新しいログイン情報は入力しません。
        </Muted>

        <Text style={s.label}>開始（JST）</Text>
        <View style={s.dtRow}>
          <TouchableOpacity style={s.dtBtn} onPress={() => setPicker('startDate')}>
            <Text style={s.dtText}>{start.date || '日付を選ぶ'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.dtBtn} onPress={() => setPicker('startTime')}>
            <Text style={s.dtText}>{start.time || '時刻'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.label}>終了（JST）</Text>
        <View style={s.dtRow}>
          <TouchableOpacity style={s.dtBtn} onPress={() => setPicker('endDate')}>
            <Text style={s.dtText}>{end.date || '日付を選ぶ'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.dtBtn} onPress={() => setPicker('endTime')}>
            <Text style={s.dtText}>{end.time || '時刻'}</Text>
          </TouchableOpacity>
        </View>

        <Button onPress={create} disabled={saving} style={s.primaryBtn}>
          <Text style={s.primaryBtnText}>{saving ? '保存中…' : '招待を作成'}</Text>
        </Button>
      </Card>

      {/* ── 招待・利用権限 ───────────────────────────────────────────── */}
      <Card style={s.card}>
        <Title style={s.cardTitle}>招待・利用権限</Title>
        {!data?.invitations.length && <Muted style={s.note}>招待はありません。</Muted>}
        {data?.invitations.map((invite: SupporterInvitation) => {
          const state = supporterInvitationState(invite, nowIso);
          const canChange = state !== '取り消し済み' && state !== '期限切れ';
          return (
            <View key={invite.id} style={s.inviteBox}>
              <Text style={s.inviteTitle}>
                {invite.childName} — {invite.displayName || '共通アカウント'}
              </Text>
              <Muted style={s.inviteLine}>PUBLIC CODE: {invite.recipientAddress}</Muted>
              <Muted style={s.inviteLine}>
                利用期間（JST）: {jstDateTime(invite.startsAt)} 〜 {jstDateTime(invite.endsAt)}
              </Muted>
              <Muted style={s.inviteLine}>状態: {state}</Muted>
              {!!invite.acceptedAt && (
                <Muted style={s.inviteLine}>受け入れ済み: {jstDateTime(invite.acceptedAt)}</Muted>
              )}
              {!!invite.revokedAt && (
                <Muted style={s.inviteLine}>取り消し済み: {jstDateTime(invite.revokedAt)}</Muted>
              )}
              {canChange && (
                <View style={s.inviteBtnRow}>
                  <TouchableOpacity
                    style={s.outlineBtn}
                    onPress={() => {
                      setExtendId(invite.id);
                      setExtendAt(toJstParts(invite.endsAt));
                    }}
                  >
                    <Text style={s.outlineBtnText}>期限を変更</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.outlineBtn, s.dangerBtn]}
                    disabled={saving}
                    onPress={() => revoke(invite.id)}
                  >
                    <Text style={[s.outlineBtnText, s.dangerText]}>取り消す</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </Card>

      {/* ── 期限を変更 ───────────────────────────────────────────────── */}
      <Modal
        visible={extendId !== null && picker === null}
        transparent
        animationType="slide"
        onRequestClose={() => setExtendId(null)}
      >
        <View style={[s.overlay, kbHeight > 0 && { paddingBottom: kbHeight }]}>
          <View style={s.sheet}>
            <Title style={s.cardTitle}>利用期限を変更</Title>
            <Muted style={s.hint}>終了日時は現在の終了日時より後にしてください。</Muted>
            <Text style={s.label}>終了（JST）</Text>
            <View style={s.dtRow}>
              <TouchableOpacity style={s.dtBtn} onPress={() => setPicker('extendDate')}>
                <Text style={s.dtText}>{extendAt.date || '日付を選ぶ'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.dtBtn} onPress={() => setPicker('extendTime')}>
                <Text style={s.dtText}>{extendAt.time || '時刻'}</Text>
              </TouchableOpacity>
            </View>
            <View style={s.inviteBtnRow}>
              <TouchableOpacity style={s.outlineBtn} onPress={() => setExtendId(null)}>
                <Text style={s.outlineBtnText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.primarySmall} disabled={saving} onPress={submitExtend}>
                <Text style={s.primaryBtnText}>{saving ? '保存中…' : '更新する'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 日付ピッカー（入れ子 Modal を避けるため兄弟配置） */}
      <DatePickerModal
        visible={picker === 'startDate' || picker === 'endDate' || picker === 'extendDate'}
        initialDate={
          picker === 'startDate' ? start.date : picker === 'endDate' ? end.date : extendAt.date
        }
        onConfirm={(iso: string) => {
          if (picker === 'startDate') setStart((prev) => ({ ...prev, date: iso }));
          else if (picker === 'endDate') setEnd((prev) => ({ ...prev, date: iso }));
          else setExtendAt((prev) => ({ ...prev, date: iso }));
        }}
        onClose={() => setPicker(null)}
        title="日付を選ぶ"
      />

      {/* 時刻ピッカー */}
      <Modal
        visible={picker === 'startTime' || picker === 'endTime' || picker === 'extendTime'}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Title style={s.cardTitle}>時刻を選ぶ</Title>
            <ScrollTimePicker
              value={
                (picker === 'startTime' ? start.time : picker === 'endTime' ? end.time : extendAt.time) || '00:00'
              }
              onChange={(v: string) => {
                if (picker === 'startTime') setStart((prev) => ({ ...prev, time: v }));
                else if (picker === 'endTime') setEnd((prev) => ({ ...prev, time: v }));
                else setExtendAt((prev) => ({ ...prev, time: v }));
              }}
            />
            <Button onPress={() => setPicker(null)} style={s.primaryBtn}>
              <Text style={s.primaryBtnText}>決定</Text>
            </Button>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  center: { paddingVertical: 48, alignItems: 'center' },
  lead: { fontSize: 12, lineHeight: 18 },
  error: {
    backgroundColor: '#FEF2F2',
    color: '#B91C1C',
    padding: 12,
    borderRadius: radius.md,
    fontSize: 13,
  },
  card: { padding: 16, gap: 8 },
  cardTitle: { fontSize: 18 },
  label: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  hint: { fontSize: 11, lineHeight: 16 },
  note: { fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: palette.foreground,
    backgroundColor: '#fff',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: palette.primary, borderColor: palette.primary },
  chipText: { fontSize: 14, color: palette.foreground },
  chipTextOn: { color: '#fff', fontWeight: '700' },
  dtRow: { flexDirection: 'row', gap: 8 },
  dtBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  dtText: { fontSize: 15, color: palette.foreground },
  primaryBtn: { backgroundColor: palette.primary, marginTop: 12 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  primarySmall: {
    flex: 1,
    backgroundColor: palette.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  inviteBox: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: radius.md,
    padding: 12,
    marginTop: 8,
    gap: 2,
  },
  inviteTitle: { fontSize: 15, fontWeight: '700' },
  inviteLine: { fontSize: 12, lineHeight: 18 },
  inviteBtnRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  outlineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  outlineBtnText: { fontSize: 14, fontWeight: '700', color: palette.foreground },
  dangerBtn: { borderColor: '#FECACA' },
  dangerText: { color: '#DC2626' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    gap: 6,
  },
});
