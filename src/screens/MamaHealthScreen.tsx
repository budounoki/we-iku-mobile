import React, { useState, useEffect, useRef } from 'react';
import { useRoute } from '@react-navigation/native';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  HeartPulse, Pill, ChevronLeft, ChevronRight, Plus, Minus,
  Frown, Annoyed, Meh, Smile, Laugh,
} from 'lucide-react-native';
import { apiGet, apiPost } from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { MamaHealthRecord, MamaMedicineRecord } from '@shared/schema';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Card, Button, Text, Title, Muted } from '../theme/ui';
import { useTheme } from '../contexts/ThemeContext';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

// ── Constants ──────────────────────────────────────────────────────────────

// web と同じ選択肢に統一（client 2026-10: ママのからだ記録を web と同じに）。
const LOCHIA_OPTIONS: { value: string; label: string }[] = [
  { value: 'heavy', label: '多め' },
  { value: 'normal', label: '普通' },
  { value: 'light', label: '少なめ' },
  { value: 'none', label: 'なし' },
];
// 旧データ互換（以前は medium=中程度 だった）。表示/選択で normal として扱う。
const LOCHIA_LABELS: Record<string, string> = { heavy: '多め', normal: '普通', medium: '普通', light: '少なめ', none: 'なし' };

const PAIN_LABELS = ['なし', '弱', '中', '強', '激'];

// Mood scale rendered with lucide face icons (matches the web app's icon style)
const MOOD_ICONS = [Frown, Annoyed, Meh, Smile, Laugh];
const MOOD_LABELS = ['辛い', '少し辛い', '普通', 'まあまあ', '良好'];

const SLEEP_MINUTES_OPTIONS = [0, 15, 30, 45];

// web と同じ授乳トラブルの選択肢。
const BREASTFEEDING_TROUBLES = [
  '乳首の痛み',
  '張り',
  '詰まり',
  '白斑',
  '乳腺炎の疑い',
];

// ── Helpers ────────────────────────────────────────────────────────────────

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
function formatHistDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}

// お薬の履歴用: 日時（M月d日 HH:mm）。
function formatMedDateTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}

// web と同じ色のチップ（過去の記録の表示用）。
const CHIP_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  pink: { bg: '#FDF2F8', border: '#FBCFE8', text: '#BE185D' },
  rose: { bg: '#FFF1F2', border: '#FECDD3', text: '#BE123C' },
  violet: { bg: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9' },
  blue: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },
  green: { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D' },
  amber: { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309' },
};

function MamaChip({ color, label }: { color: keyof typeof CHIP_COLORS; label: string }) {
  const c = CHIP_COLORS[color];
  return (
    <View style={{ backgroundColor: c.bg, borderColor: c.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ fontSize: 11, fontFamily: fonts.bodyBold, color: c.text }}>{label}</Text>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={styles.card}>
      <Title style={styles.sectionTitle}>{title}</Title>
      {children}
    </Card>
  );
}

function ToggleRow({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <TouchableOpacity
        style={[styles.toggleBtn, value === true && styles.toggleBtnActive]}
        onPress={() => onChange(true)}
      >
        <Text style={[styles.toggleLabel, value === true && styles.toggleLabelActive]}>
          あり
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.toggleBtn, value === false && styles.toggleBtnActive]}
        onPress={() => onChange(false)}
      >
        <Text style={[styles.toggleLabel, value === false && styles.toggleLabelActive]}>
          なし
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function MamaHealthScreen() {
  const { isDark, colors } = useTheme();
  const route = useRoute();
  const scrollRef = useRef<ScrollView>(null);
  const [medicineCardY, setMedicineCardY] = useState(0);
  // 「ママの薬を記録する」から来たときは、お薬セクションまで自動でスクロールする
  // （client 2026-10: お薬の履歴/記録が下にあって見つけにくい）。
  useEffect(() => {
    if ((route.params as any)?.focus === 'medicine' && medicineCardY > 0) {
      const t = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, medicineCardY - 12), animated: true }), 300);
      return () => clearTimeout(t);
    }
  }, [route.params, medicineCardY]);
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const kbHeight = useKeyboardHeight();
  const today = toDateString(new Date());

  // ── Date state ──────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(today);

  function changeDate(delta: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    const next = toDateString(d);
    if (next > today) return; // no future dates
    setSelectedDate(next);
  }

  // ── Form state ──────────────────────────────────────────────────────────
  const [bowelMovement, setBowelMovement] = useState<boolean | null>(null);
  const [bowelNote, setBowelNote] = useState('');
  const [lochiaState, setLochiaState] = useState<string | null>(null);
  const [perineumPain, setPerineumPain] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [sleepHours, setSleepHours] = useState(6);
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [selectedTroubles, setSelectedTroubles] = useState<string[]>([]);
  const [weightKg, setWeightKg] = useState('');
  const [hasEdema, setHasEdema] = useState<boolean | null>(null);
  const [holdingTime, setHoldingTime] = useState('');
  const [showMamaHistory, setShowMamaHistory] = useState(false);

  // ── Medicine modal state ─────────────────────────────────────────────────
  const [medicineModalVisible, setMedicineModalVisible] = useState(false);
  const [showMedHistory, setShowMedHistory] = useState(false);
  const [medicineName, setMedicineName] = useState('');
  const [medicineDosage, setMedicineDosage] = useState('');
  const [medicineMemo, setMedicineMemo] = useState('');

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: medicines = [], isLoading: medicinesLoading } = useQuery<MamaMedicineRecord[]>({
    queryKey: ['mama-medicine', user?.familyId],
    queryFn: () => apiGet<MamaMedicineRecord[]>(`/api/mama-medicine/${user!.familyId}`),
    enabled: !!user?.familyId,
  });

  // 保存済みのからだ記録。以前はこのクエリ自体が無く、保存しても読み戻されず
  // 画面には常に初期値しか出ていなかった（client 2026-10: ママの体の記録が反映されない）。
  const { data: healthRecords = [] } = useQuery<MamaHealthRecord[]>({
    queryKey: ['mama-health', user?.familyId],
    queryFn: () => apiGet<MamaHealthRecord[]>(`/api/mama-health/${user!.familyId}`),
    enabled: !!user?.familyId,
  });

  // 選択中の日付の記録でフォームを復元（無ければ初期値に戻す）。保存後は invalidate →
  // 再取得 → ここで最新値に同期される。
  useEffect(() => {
    const rec = healthRecords.find((r) => r.recordedDate === selectedDate);
    if (rec) {
      setBowelMovement(rec.bowelMovement ?? null);
      setBowelNote(rec.bowelNote ?? '');
      setLochiaState(rec.lochiaState === 'medium' ? 'normal' : (rec.lochiaState ?? null));
      setPerineumPain(rec.perineumPain ?? null);
      setMood(rec.mood ?? null);
      setSleepHours(rec.sleepHours ?? 6);
      setSleepMinutes(rec.sleepMinutes ?? 0);
      setSelectedTroubles(rec.breastfeedingTrouble ? rec.breastfeedingTrouble.split(',').filter(Boolean) : []);
      setWeightKg(rec.weightKg ?? '');
      setHasEdema(rec.hasEdema ?? null);
      setHoldingTime(rec.holdingTime != null ? String(rec.holdingTime) : '');
    } else {
      setBowelMovement(null); setBowelNote(''); setLochiaState(null);
      setPerineumPain(null); setMood(null); setSleepHours(6); setSleepMinutes(0);
      setSelectedTroubles([]); setWeightKg(''); setHasEdema(null); setHoldingTime('');
    }
  }, [selectedDate, healthRecords]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const saveHealthMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPost<MamaHealthRecord>('/api/mama-health', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mama-health', user?.familyId] });
      Alert.alert('記録しました', '今日のからだの記録を保存しました。');
    },
    onError: () => {
      Alert.alert('エラー', '記録の保存に失敗しました。');
    },
  });

  const saveMedicineMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPost<MamaMedicineRecord>('/api/mama-medicine', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mama-medicine', user?.familyId] });
      setMedicineModalVisible(false);
      setMedicineName('');
      setMedicineDosage('');
      setMedicineMemo('');
    },
    onError: () => {
      Alert.alert('エラー', 'お薬の記録に失敗しました。');
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────────
  function toggleTrouble(item: string) {
    setSelectedTroubles((prev) =>
      prev.includes(item) ? prev.filter((t) => t !== item) : [...prev, item],
    );
  }

  function handleSave() {
    if (!user) return;
    const payload: Record<string, unknown> = {
      familyId: user.familyId,
      userId: user.lineUserId || String(user.id),
      recordedDate: selectedDate,
      bowelMovement: bowelMovement,
      bowelNote: bowelNote.trim() || null,
      lochiaState: lochiaState,
      perineumPain: perineumPain,
      mood: mood,
      sleepHours,
      sleepMinutes,
      breastfeedingTrouble: selectedTroubles.length > 0 ? selectedTroubles.join(',') : null,
      weightKg: weightKg.trim() || null,
      hasEdema: hasEdema,
      holdingTime: holdingTime.trim() ? parseInt(holdingTime.trim(), 10) : null,
    };
    saveHealthMutation.mutate(payload);
  }

  function handleSaveMedicine() {
    if (!user) return;
    if (!medicineName.trim()) {
      Alert.alert('入力エラー', '薬の名前を入力してください。');
      return;
    }
    saveMedicineMutation.mutate({
      familyId: user.familyId,
      userId: user.lineUserId || String(user.id),
      medicineName: medicineName.trim(),
      dosage: medicineDosage.trim() || null,
      memo: medicineMemo.trim() || null,
    });
  }

  // 過去の記録（新しい日付順）。web の「過去の記録」一覧と同じ表示に使う。
  const sortedMamaRecords = [...healthRecords].sort((a, b) =>
    a.recordedDate < b.recordedDate ? 1 : a.recordedDate > b.recordedDate ? -1 : 0,
  );

  // お薬の記録は「あなただけに表示される」ので、ログイン中ユーザー本人の記録だけに絞る
  // （web の owner-privacy と同じ考え方。client 2026-10）。
  const myMedicineUserId = user ? (user.lineUserId || String(user.id)) : '';
  const myMedicines = medicines.filter((m) => (m.userId ?? '') === myMedicineUserId);

  // お薬の履歴（新しい順）。web の「お薬の履歴を見る」と同じ表示に使う。
  const sortedMedicines = [...myMedicines].sort((a, b) => {
    const ta = new Date((a.takenAt ?? a.createdAt) as any).getTime() || 0;
    const tb = new Date((b.takenAt ?? b.createdAt) as any).getTime() || 0;
    return tb - ta;
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, isDark && { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <HeartPulse size={20} color={palette.primaryForeground} />
          <Text style={styles.headerTitle}>ママのからだ記録</Text>
        </View>
        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateArrow} onPress={() => changeDate(-1)}>
            <ChevronLeft size={24} color={palette.primaryForeground} />
          </TouchableOpacity>
          <Text style={styles.dateLabel}>{formatDisplayDate(selectedDate)}</Text>
          <TouchableOpacity
            style={[styles.dateArrow, selectedDate >= today && styles.dateArrowDisabled]}
            onPress={() => changeDate(1)}
            disabled={selectedDate >= today}
          >
            <ChevronRight
              size={24}
              color={selectedDate >= today ? 'rgba(255,255,255,0.4)' : palette.primaryForeground}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* 過去の記録（web と同じ。日付ごとにチップでまとめて表示・編集へ） */}
        {sortedMamaRecords.length > 0 && (
          <Card style={styles.card}>
            <TouchableOpacity
              style={styles.histToggle}
              onPress={() => setShowMamaHistory((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.histToggleTitle}>過去の記録 ({sortedMamaRecords.length}件)</Text>
              <Text style={styles.histToggleAction}>{showMamaHistory ? '▲ 閉じる' : '▼ 見る'}</Text>
            </TouchableOpacity>

            {showMamaHistory && sortedMamaRecords.map((rec) => {
              const isToday = rec.recordedDate === today;
              const troubles = rec.breastfeedingTrouble ? rec.breastfeedingTrouble.split(',').filter(Boolean) : [];
              return (
                <View key={rec.id} style={styles.histRow}>
                  <View style={styles.histHeadRow}>
                    <View style={styles.histDateWrap}>
                      <Text style={styles.histDate}>{formatHistDate(rec.recordedDate)}</Text>
                      {isToday && <View style={styles.histTodayBadge}><Text style={styles.histTodayText}>今日</Text></View>}
                    </View>
                    <TouchableOpacity onPress={() => { setSelectedDate(rec.recordedDate); setShowMamaHistory(false); }} activeOpacity={0.7}>
                      <Text style={styles.histEdit}>編集</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.histChipWrap}>
                    {rec.bowelMovement != null && <MamaChip color="pink" label={`お通じ ${rec.bowelMovement ? 'あり' : 'なし'}`} />}
                    {rec.lochiaState && <MamaChip color="pink" label={`悪露 ${LOCHIA_LABELS[rec.lochiaState] || rec.lochiaState}`} />}
                    {rec.perineumPain != null && <MamaChip color="rose" label={`痛み ${rec.perineumPain}/4`} />}
                    {rec.mood != null && <MamaChip color="violet" label={`気分 ${MOOD_LABELS[rec.mood] ?? ''}`} />}
                    {(rec.sleepHours != null || rec.sleepMinutes != null) && (
                      <MamaChip color="blue" label={`睡眠 ${rec.sleepHours ?? 0}h${rec.sleepMinutes ? `${rec.sleepMinutes}m` : ''}`} />
                    )}
                    {!!rec.weightKg && <MamaChip color="green" label={`${rec.weightKg}kg${rec.hasEdema != null ? (rec.hasEdema ? ' むくみ○' : ' むくみ×') : ''}`} />}
                    {troubles.length > 0 && <MamaChip color="amber" label={`授乳: ${troubles.join('・')}`} />}
                  </View>
                  {(rec.bowelNote) && <Text style={styles.histNote}>{rec.bowelNote}</Text>}
                </View>
              );
            })}
          </Card>
        )}

        {/* Section 1: お通じ */}
        <SectionCard title="お通じ">
          <ToggleRow value={bowelMovement} onChange={setBowelMovement} />
          {bowelMovement === true && (
            <TextInput
              style={styles.textInput}
              placeholder="メモ（任意）"
              placeholderTextColor={palette.mutedForeground}
              value={bowelNote}
              onChangeText={setBowelNote}
              multiline
            />
          )}
        </SectionCard>

        {/* Section 2: 悪露 */}
        <SectionCard title="悪露">
          <View style={styles.radioRow}>
            {LOCHIA_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.radioBtn, lochiaState === opt.value && styles.radioBtnActive]}
                onPress={() => setLochiaState(opt.value)}
              >
                <Text style={[styles.radioBtnText, lochiaState === opt.value && styles.radioBtnTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SectionCard>

        {/* Section 3: 会陰の痛み */}
        <SectionCard title="会陰の痛み">
          <View style={styles.scaleRow}>
            {PAIN_LABELS.map((label, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.scaleCircle, perineumPain === idx && styles.scaleCircleActive]}
                onPress={() => setPerineumPain(idx)}
              >
                <Text style={[styles.scaleLabel, perineumPain === idx && styles.scaleLabelActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SectionCard>

        {/* Section 4: 気分 */}
        <SectionCard title="気分">
          <View style={styles.moodRow}>
            {MOOD_ICONS.map((MoodIcon, idx) => {
              const active = mood === idx;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.moodBtn, active && styles.moodBtnActive]}
                  onPress={() => setMood(idx)}
                >
                  <MoodIcon
                    size={26}
                    color={active ? palette.primary : palette.mutedForeground}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </SectionCard>

        {/* Section 5: 睡眠時間 */}
        <SectionCard title="睡眠時間">
          <View style={styles.sleepRow}>
            {/* Hours */}
            <View style={styles.stepperGroup}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setSleepHours((h) => Math.max(0, h - 1))}
              >
                <Minus size={18} color={palette.primary} />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{sleepHours}時間</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setSleepHours((h) => Math.min(24, h + 1))}
              >
                <Plus size={18} color={palette.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sleepSep}> </Text>

            {/* Minutes */}
            <View style={styles.stepperGroup}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => {
                  const idx = SLEEP_MINUTES_OPTIONS.indexOf(sleepMinutes);
                  setSleepMinutes(SLEEP_MINUTES_OPTIONS[Math.max(0, idx - 1)]);
                }}
              >
                <Minus size={18} color={palette.primary} />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{sleepMinutes}分</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => {
                  const idx = SLEEP_MINUTES_OPTIONS.indexOf(sleepMinutes);
                  setSleepMinutes(SLEEP_MINUTES_OPTIONS[Math.min(SLEEP_MINUTES_OPTIONS.length - 1, idx + 1)]);
                }}
              >
                <Plus size={18} color={palette.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </SectionCard>

        {/* Section 6: 授乳トラブル */}
        <SectionCard title="授乳トラブル">
          <View style={styles.chipWrap}>
            {BREASTFEEDING_TROUBLES.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.chip, selectedTroubles.includes(item) && styles.chipActive]}
                onPress={() => toggleTrouble(item)}
              >
                <Text style={[styles.chipText, selectedTroubles.includes(item) && styles.chipTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SectionCard>

        {/* Section 7: 体重 */}
        <SectionCard title="体重">
          <View style={styles.weightRow}>
            <TextInput
              style={styles.weightInput}
              placeholder="例: 55.5"
              placeholderTextColor={palette.mutedForeground}
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="decimal-pad"
            />
            <Text style={styles.weightUnit}>kg</Text>
          </View>
        </SectionCard>

        {/* Section 8: むくみ */}
        <SectionCard title="むくみ">
          <ToggleRow value={hasEdema} onChange={setHasEdema} />
        </SectionCard>

        {/* Section 9: 抱っこ */}
        <SectionCard title="抱っこ時間">
          <View style={styles.weightRow}>
            <TextInput
              style={styles.weightInput}
              placeholder="例: 60"
              placeholderTextColor={palette.mutedForeground}
              value={holdingTime}
              onChangeText={setHoldingTime}
              keyboardType="number-pad"
            />
            <Text style={styles.weightUnit}>分</Text>
          </View>
        </SectionCard>

        {/* Medicine Card */}
        <Card style={styles.card} onLayout={(e) => setMedicineCardY(e.nativeEvent.layout.y)}>
          <View style={styles.medicineTitleRow}>
            <Pill size={18} color={palette.primary} />
            <Title style={styles.sectionTitle}>自分のお薬を記録</Title>
          </View>

          {medicinesLoading ? (
            <ActivityIndicator color={palette.primary} style={{ marginVertical: 8 }} />
          ) : myMedicines.length === 0 ? (
            <Muted style={styles.emptyText}>お薬の記録がありません</Muted>
          ) : (
            myMedicines.slice(0, 5).map((m) => (
              <View key={m.id} style={styles.medicineItem}>
                <Text style={styles.medicineName}>{m.medicineName}</Text>
                {m.dosage ? <Muted style={styles.medicineSub}>{m.dosage}</Muted> : null}
                {m.memo ? <Muted style={styles.medicineSub}>{m.memo}</Muted> : null}
              </View>
            ))
          )}

          <Button
            variant="outline"
            onPress={() => setMedicineModalVisible(true)}
            style={styles.addMedicineBtn}
          >
            <Plus size={16} color={palette.primary} />
            <Text style={styles.addMedicineBtnText}>お薬を記録</Text>
          </Button>

          {/* 記録が無くても常に表示（web と同じ。開くと空状態を出す）。 */}
          <Button
            variant="outline"
            onPress={() => setShowMedHistory(true)}
            style={[styles.addMedicineBtn, { marginTop: 8 }]}
          >
            <Text style={styles.addMedicineBtnText}>お薬の履歴を見る{myMedicines.length > 0 ? `（${myMedicines.length}件）` : ''}</Text>
          </Button>
        </Card>

        {/* Save button */}
        <Button
          onPress={handleSave}
          disabled={saveHealthMutation.isPending}
          style={[styles.saveBtn, saveHealthMutation.isPending && styles.saveBtnDisabled]}
        >
          {saveHealthMutation.isPending ? (
            <ActivityIndicator color={palette.primaryForeground} />
          ) : (
            <Text style={styles.saveBtnText}>記録する</Text>
          )}
        </Button>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Medicine Modal */}
      <Modal
        visible={medicineModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setMedicineModalVisible(false)}
      >
        {/* Modal 内では KeyboardAvoidingView が効かないため、キーボード高さ分だけ
            余白を入れてカードを持ち上げる（client 2026-10）。 */}
        <View style={[styles.modalOverlay, kbHeight > 0 && { paddingBottom: kbHeight }]}>
          <View style={styles.modalCard}>
            <Title style={styles.modalTitle}>お薬を記録</Title>

            <Muted style={styles.modalLabel}>薬の名前 *</Muted>
            <TextInput
              style={styles.modalInput}
              placeholder="例: ロキソニン"
              placeholderTextColor={palette.mutedForeground}
              value={medicineName}
              onChangeText={setMedicineName}
            />

            <Muted style={styles.modalLabel}>用量（任意）</Muted>
            <TextInput
              style={styles.modalInput}
              placeholder="例: 1錠"
              placeholderTextColor={palette.mutedForeground}
              value={medicineDosage}
              onChangeText={setMedicineDosage}
            />

            <Muted style={styles.modalLabel}>メモ（任意）</Muted>
            <TextInput
              style={[styles.modalInput, { height: 70 }]}
              placeholder="メモを入力"
              placeholderTextColor={palette.mutedForeground}
              value={medicineMemo}
              onChangeText={setMedicineMemo}
              multiline
            />

            <View style={styles.modalBtnRow}>
              <Button
                variant="outline"
                onPress={() => setMedicineModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </Button>
              <Button
                onPress={handleSaveMedicine}
                disabled={saveMedicineMutation.isPending}
                style={[styles.modalSaveBtn, saveMedicineMutation.isPending && styles.saveBtnDisabled]}
              >
                {saveMedicineMutation.isPending ? (
                  <ActivityIndicator color={palette.primaryForeground} />
                ) : (
                  <Text style={styles.modalSaveText}>記録する</Text>
                )}
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* お薬の履歴を見る（web と同じ。これまでの服薬を新しい順に一覧表示）。 */}
      <Modal
        visible={showMedHistory}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMedHistory(false)}
      >
        <View style={[styles.modalOverlay, kbHeight > 0 && { paddingBottom: kbHeight }]}>
          <View style={[styles.modalCard, { maxHeight: '82%' }]}>
            <View style={styles.medicineTitleRow}>
              <Pill size={18} color={palette.primary} />
              <Title style={styles.modalTitle}>お薬の履歴</Title>
            </View>
            <Muted style={styles.medHistCount}>{sortedMedicines.length}件</Muted>
            <ScrollView style={{ marginTop: 4 }} showsVerticalScrollIndicator>
              {sortedMedicines.length === 0 ? (
                <Muted style={styles.emptyText}>お薬の記録がありません</Muted>
              ) : (
                sortedMedicines.map((m) => (
                  <View key={m.id} style={styles.medHistItem}>
                    <Text style={styles.medHistDate}>{formatMedDateTime(m.takenAt ?? m.createdAt)}</Text>
                    <Text style={styles.medicineName}>{m.medicineName}</Text>
                    {m.dosage ? <Muted style={styles.medicineSub}>用量: {m.dosage}</Muted> : null}
                    {m.memo ? <Muted style={styles.medicineSub}>{m.memo}</Muted> : null}
                  </View>
                ))
              )}
            </ScrollView>
            <Button
              variant="outline"
              onPress={() => setShowMedHistory(false)}
              style={[styles.addMedicineBtn, { marginTop: 12 }]}
            >
              <Text style={styles.addMedicineBtnText}>閉じる</Text>
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },

  // Header
  header: {
    backgroundColor: palette.primary,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  headerTitle: {
    color: palette.primaryForeground,
    fontSize: 18,
    fontFamily: fonts.sans,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateArrow: {
    padding: 8,
  },
  dateArrowDisabled: {
    opacity: 0.3,
  },
  dateLabel: {
    color: palette.primaryForeground,
    fontSize: 15,
    fontFamily: fonts.bodySemibold,
    minWidth: 130,
    textAlign: 'center',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  // Card / Section
  card: {
    padding: 16,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    color: palette.primary,
    marginBottom: 12,
  },

  // 過去の記録
  histToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  histToggleTitle: { fontSize: 13, fontFamily: fonts.bodyBold, color: '#DB2777' },
  histToggleAction: { fontSize: 13, fontFamily: fonts.bodyBold, color: '#DB2777' },
  histRow: { borderTopWidth: 1, borderTopColor: '#FBCFE8', paddingTop: 10, marginTop: 10 },
  histHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  histDateWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  histDate: { fontSize: 12, fontFamily: fonts.bodyBold, color: '#BE185D' },
  histTodayBadge: { backgroundColor: '#EC4899', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  histTodayText: { fontSize: 9, fontFamily: fonts.bodyBold, color: '#FFFFFF' },
  histEdit: { fontSize: 11, fontFamily: fonts.bodyBold, color: '#F472B6' },
  histChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  histNote: { fontSize: 10, color: palette.mutedForeground, marginTop: 6, lineHeight: 15 },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  toggleLabel: {
    fontSize: 14,
    color: palette.mutedForeground,
    fontFamily: fonts.bodySemibold,
  },
  toggleLabelActive: {
    color: palette.primaryForeground,
  },

  // TextInput inside card
  textInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.sm,
    padding: 10,
    fontSize: 14,
    fontFamily: fonts.body,
    color: palette.foreground,
    minHeight: 60,
    textAlignVertical: 'top',
  },

  // Horizontal radio
  radioRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radioBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
  },
  radioBtnActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  radioBtnText: {
    fontSize: 13,
    color: palette.mutedForeground,
    fontFamily: fonts.bodySemibold,
  },
  radioBtnTextActive: {
    color: palette.primaryForeground,
  },

  // Scale row (pain circles)
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  scaleCircle: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleCircleActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  scaleLabel: {
    fontSize: 11,
    color: palette.mutedForeground,
    fontFamily: fonts.bodySemibold,
  },
  scaleLabelActive: {
    color: palette.primaryForeground,
  },

  // Mood row (lucide face icons)
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  moodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
  },
  moodBtnActive: {
    backgroundColor: palette.accent,
    borderColor: palette.primary,
  },

  // Stepper (sleep)
  sleepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  sleepSep: {
    width: 8,
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: palette.foreground,
    minWidth: 52,
    textAlign: 'center',
  },

  // Chips
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: palette.accent,
  },
  chipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  chipText: {
    fontSize: 13,
    color: palette.mutedForeground,
    fontFamily: fonts.bodySemibold,
  },
  chipTextActive: {
    color: palette.primaryForeground,
  },

  // Weight / holding row
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: fonts.body,
    color: palette.foreground,
  },
  weightUnit: {
    fontSize: 15,
    color: palette.mutedForeground,
    fontFamily: fonts.bodySemibold,
  },

  // Medicine list
  medicineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: palette.mutedForeground,
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  medicineItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  medHistCount: { fontSize: 11, color: palette.mutedForeground, marginBottom: 4 },
  medHistItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  medHistDate: { fontSize: 11, fontFamily: fonts.bodyBold, color: '#9333EA', marginBottom: 2 },
  medicineName: {
    fontSize: 14,
    fontFamily: fonts.bodySemibold,
    color: palette.foreground,
  },
  medicineSub: {
    fontSize: 12,
    color: palette.mutedForeground,
    marginTop: 2,
  },
  addMedicineBtn: {
    marginTop: 12,
    minHeight: 44,
    backgroundColor: 'transparent',
    borderColor: palette.primary,
  },
  addMedicineBtnText: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },

  // Save button
  saveBtn: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
    borderRadius: radius.sm,
    minHeight: 50,
    marginTop: 8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: palette.primaryForeground,
    fontSize: 16,
    fontFamily: fonts.bodyBold,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: palette.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: {
    fontSize: 17,
    color: palette.primary,
    marginBottom: 18,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 13,
    color: palette.mutedForeground,
    fontFamily: fonts.bodySemibold,
    marginBottom: 4,
    marginTop: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: fonts.body,
    color: palette.foreground,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalCancelBtn: {
    flex: 1,
    minHeight: 48,
    backgroundColor: 'transparent',
    borderColor: palette.border,
  },
  modalCancelText: {
    color: palette.mutedForeground,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  modalSaveBtn: {
    flex: 2,
    minHeight: 48,
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  modalSaveText: {
    color: palette.primaryForeground,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
});
