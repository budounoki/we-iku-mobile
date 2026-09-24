import { apiGet, apiPost } from './client';

export interface FamilyPlan {
  tier: 'free' | 'premium' | 'free_forever';
  productId?: string | null;
  platform?: string | null;
  status?: string | null;
  expiresAt?: string | null;
  purchasedByUserId?: number | null;
}

export const PREMIUM_SKUS = ['premium_monthly_500', 'premium_yearly_5000'] as const;

export async function getFamilyPlan(familyId: string): Promise<FamilyPlan> {
  return apiGet<FamilyPlan>(`/api/families/${encodeURIComponent(familyId)}/plan`);
}

/**
 * 購入・復元共通：ストアの購入証明をサーバーで検証して家族プランに反映する。
 * iOS は StoreKit2 の JWS、Android は purchaseToken（expo-iap では両方とも
 * purchase.purchaseToken に入る）。
 */
export async function verifyPurchase(params: {
  familyId: string;
  platform: 'ios' | 'android';
  purchaseToken: string;
}): Promise<FamilyPlan> {
  return apiPost<FamilyPlan>('/api/premium/verify', {
    familyId: params.familyId,
    platform: params.platform,
    ...(params.platform === 'ios'
      ? { jws: params.purchaseToken }
      : { purchaseToken: params.purchaseToken }),
  });
}
