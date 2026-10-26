import { addMonths, differenceInCalendarDays } from 'date-fns';
import {
  VACCINE_DEFINITIONS,
  normalizeVaccineId,
  type VaccineDefinition,
} from './vaccine-schedule';

export type VaccineReminderStage = 'pre' | 'due' | 'overdue';

export interface VaccineReminder {
  vaccineId: string;
  vaccineName: string;
  stage: VaccineReminderStage;
  targetDate: string; // yyyy-MM-dd
  message: string;
}

function buildMessage(vaccine: VaccineDefinition, stage: VaccineReminderStage): string {
  const label = vaccine.name;
  if (stage === 'pre') return `もうすぐ${label}の接種時期です`;
  if (stage === 'due') return `${label}が接種時期です`;
  return `${label}の接種時期を過ぎています。かかりつけ医にご相談ください`;
}

/**
 * リマインド対象ワクチンを算出する。web とアプリ共通の新カタログ
 * （@shared/vaccine-schedule の VACCINE_DEFINITIONS。回次ごとに standardAgeMonths を持つ）
 * を用いる。接種済み判定は normalizeVaccineId で旧形式の記録も拾う。
 * - グループ（五種混合 等）ごとに「次に打つべき最も早い未接種の回」を1件だけ通知する
 * - 段階判定（標準接種月齢 standardAgeMonths 基準）:
 *   due:     標準接種日（誕生日+standardヶ月）を過ぎている
 *   overdue: 標準+3ヶ月を過ぎている
 *   pre:     標準接種日が leadDays 以内に迫っている
 */
export function computeVaccineReminders(params: {
  birthday: string;
  vaccineRecords: Array<{ vaccineId: string }>;
  leadDays: number;
  today?: Date;
}): VaccineReminder[] {
  const { birthday, vaccineRecords, leadDays } = params;
  if (!birthday) return [];
  const today = params.today ?? new Date();
  const birth = new Date(birthday);
  const completedIds = new Set(vaccineRecords.map((r) => normalizeVaccineId(r.vaccineId)));

  // グループごとに回次順で並べ、次に打つべき未接種の回を選ぶ。
  const byGroup = new Map<string, VaccineDefinition[]>();
  for (const v of VACCINE_DEFINITIONS) {
    if (v.isOptional) continue; // 任意接種はリマインド対象外
    if (!byGroup.has(v.group)) byGroup.set(v.group, []);
    byGroup.get(v.group)!.push(v);
  }

  const reminders: VaccineReminder[] = [];
  for (const doses of byGroup.values()) {
    const sorted = [...doses].sort((a, b) => a.doseNumber - b.doseNumber);
    const nextDose = sorted.find((d) => !completedIds.has(d.id));
    if (!nextDose) continue; // 全回次 接種済み

    const targetDate = addMonths(birth, nextDose.standardAgeMonths);
    const overdueDate = addMonths(birth, nextDose.standardAgeMonths + 3);
    const daysUntil = differenceInCalendarDays(targetDate, today);
    const daysPastOverdue = differenceInCalendarDays(today, overdueDate);

    let stage: VaccineReminderStage | null = null;
    if (daysPastOverdue > 0) stage = 'overdue';
    else if (daysUntil <= 0) stage = 'due';
    else if (daysUntil <= leadDays) stage = 'pre';

    if (!stage) continue;
    reminders.push({
      vaccineId: nextDose.id,
      vaccineName: nextDose.name,
      stage,
      targetDate: targetDate.toISOString().slice(0, 10),
      message: buildMessage(nextDose, stage),
    });
  }
  return reminders;
}
