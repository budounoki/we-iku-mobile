import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFamilyPlan, FamilyPlan } from '../api/premium';

const CACHE_KEY = 'familyPlanCache';

/**
 * 家族のプラン状態（free / premium / free_forever）。
 * - premium と free_forever（モニター家族）は「広告なし・ペイウォール非表示」。
 * - 起動直後はキャッシュで即描画し、裏でサーバーから最新を取る
 *   （広告の一瞬のチラつき防止。判定に迷う間は広告を出さない側に倒す）。
 */
export function usePlan(familyId: string | null | undefined) {
  const [plan, setPlan] = useState<FamilyPlan | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!familyId) { setLoading(false); return; }
    try {
      const fresh = await getFamilyPlan(familyId);
      setPlan(fresh);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ familyId, plan: fresh }));
    } catch {
      // オフライン時などはキャッシュ/現状維持
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw && mounted) {
          const cached = JSON.parse(raw);
          if (cached.familyId === familyId && cached.plan) setPlan(cached.plan);
        }
      } catch {}
      refresh();
    })();
    return () => { mounted = false; };
  }, [familyId, refresh]);

  const adFree = !plan ? true // 不明な間は広告を出さない
    : plan.tier === 'premium' || plan.tier === 'free_forever';

  return {
    plan,
    loading,
    refresh,
    /** 広告非表示対象（premium / free_forever / 判定中） */
    adFree,
    /** ペイウォール（プレミアム購入導線）を出すか */
    showPaywallEntry: plan?.tier === 'free',
    isPremium: plan?.tier === 'premium',
    isFreeForever: plan?.tier === 'free_forever',
  };
}
