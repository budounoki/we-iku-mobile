/**
 * 予防接種カタログは web と共通化した（@shared/vaccine-schedule が唯一のソース）。
 * 以前はここに mobile 独自の JP_VACCINES（四種混合ベースの古いスケジュール）があり、
 * web（五種混合ベース）と食い違っていた。共通カタログを再エクスポートして一致させる。
 * 旧データ互換（"B型肝炎 1回目" 等 → 新 id）は shared 側の normalizeVaccineId を使う。
 */
export * from "@shared/vaccine-schedule";

/** 生年月日から現在の月齢を求める（アプリ側の年齢計算で使用）。 */
export function monthsDiff(birthday: string, now: Date): number {
  const birth = new Date(birthday);
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  return years * 12 + months;
}
