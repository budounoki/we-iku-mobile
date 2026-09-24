import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  useIAP, deepLinkToSubscriptions, type ProductSubscription, type Purchase,
} from 'expo-iap';
import { useAuthStore } from '../store/authStore';
import { usePlan } from '../hooks/usePlan';
import { verifyPurchase, PREMIUM_SKUS } from '../api/premium';
import { getBaseUrl } from '../api/client';

const MONTHLY_SKU = 'premium_monthly_500';
const YEARLY_SKU = 'premium_yearly_5000';

const BENEFITS = [
  { icon: '🚫', title: '広告の非表示', desc: 'アプリ内のバナー広告が表示されなくなります' },
  { icon: '👨‍👩‍👧', title: '家族みんなに適用', desc: 'どちらかが購入すれば家族全員がプレミアムに' },
];

export default function PremiumScreen() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const familyId = user?.familyId ?? null;
  const { plan, refresh, isPremium, isFreeForever } = usePlan(familyId);
  const [busy, setBusy] = useState(false);

  const {
    connected, subscriptions, fetchProducts, finishTransaction, getAvailablePurchases,
    availablePurchases,
  } = useIAP({
    onPurchaseSuccess: (purchase) => { handlePurchaseUpdate(purchase); },
    onPurchaseError: (error) => {
      setBusy(false);
      // ユーザーキャンセルは黙って戻る
      if (String(error.code).includes('user-cancelled') || String(error.code).includes('E_USER_CANCELLED')) return;
      Alert.alert('購入エラー', error.message || '購入を完了できませんでした');
    },
  });

  useEffect(() => {
    if (connected) {
      fetchProducts({ skus: [...PREMIUM_SKUS], type: 'subs' }).catch(() => {});
    }
  }, [connected]);

  const bySku = useMemo(() => {
    const map = new Map<string, ProductSubscription>();
    for (const s of subscriptions) map.set(s.id, s);
    return map;
  }, [subscriptions]);

  async function handlePurchaseUpdate(purchase: Purchase) {
    try {
      if (!familyId) throw new Error('家族IDが見つかりません');
      const token = purchase.purchaseToken;
      if (!token) throw new Error('購入情報を取得できませんでした');
      // サーバー側でレシート検証 → 家族プランに反映
      await verifyPurchase({
        familyId,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        purchaseToken: token,
      });
      // 検証が通ってからトランザクション完了（Androidはここでacknowledge）
      await finishTransaction({ purchase, isConsumable: false });
      await refresh();
      Alert.alert('ありがとうございます！', 'プレミアムプランが有効になりました。ご家族全員に適用されます。');
    } catch (err: any) {
      Alert.alert('確認エラー', 'ご購入の確認に失敗しました。「購入の復元」をお試しいただくか、時間をおいて再度お試しください。');
    } finally {
      setBusy(false);
    }
  }

  async function buy(sku: string) {
    if (busy || !connected) return;
    setBusy(true);
    try {
      const product = bySku.get(sku);
      const offerToken = (product as any)?.subscriptionOffers?.[0]?.offerToken;
      const { requestPurchase } = await import('expo-iap');
      await requestPurchase({
        type: 'subs',
        request: {
          apple: { sku },
          google: {
            skus: [sku],
            ...(offerToken ? { subscriptionOffers: [{ sku, offerToken }] } : {}),
          },
        },
      });
      // 結果は onPurchaseSuccess / onPurchaseError で受ける
    } catch {
      setBusy(false);
    }
  }

  async function restore() {
    if (busy) return;
    setBusy(true);
    try {
      await getAvailablePurchases();
      const target = (availablePurchases ?? []).find((p) => PREMIUM_SKUS.includes(p.productId as any));
      if (target?.purchaseToken && familyId) {
        await verifyPurchase({
          familyId,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          purchaseToken: target.purchaseToken,
        });
        await refresh();
        Alert.alert('復元しました', 'プレミアムプランを復元しました。');
      } else {
        Alert.alert('購入が見つかりません', 'このアカウントに復元できる購入はありませんでした。');
      }
    } catch {
      Alert.alert('復元エラー', '購入の復元に失敗しました。時間をおいてお試しください。');
    } finally {
      setBusy(false);
    }
  }

  // ── モニター家族（無料継続）: 案内のみ ──
  if (isFreeForever) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.heroIcon}>💜</Text>
        <Text style={styles.title}>ずっと無料でご利用いただけます</Text>
        <Text style={styles.desc}>
          モニターとしてご協力いただいたご家族は、広告なしで全機能を無料でご利用いただけます。
        </Text>
      </ScrollView>
    );
  }

  // ── すでにプレミアム: 状態と管理導線のみ（購入UIは出さない） ──
  if (isPremium) {
    const expires = plan?.expiresAt ? new Date(plan.expiresAt) : null;
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.heroIcon}>⭐</Text>
        <Text style={styles.title}>プレミアムプランをご利用中</Text>
        <Text style={styles.desc}>
          {plan?.productId === YEARLY_SKU ? '年額プラン' : '月額プラン'}
          {expires ? `（次回更新/期限: ${expires.getMonth() + 1}月${expires.getDate()}日）` : ''}
        </Text>
        {plan?.status === 'canceled' && (
          <Text style={styles.canceledNote}>
            自動更新は停止されています。期限日までプレミアムをご利用いただけます。
          </Text>
        )}
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => deepLinkToSubscriptions(
            Platform.OS === 'android'
              ? { skuAndroid: plan?.productId ?? MONTHLY_SKU, packageNameAndroid: 'com.weyuapp.app' }
              : undefined as any,
          )}
        >
          <Text style={styles.secondaryBtnText}>サブスクリプションを管理</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── 未加入: ペイウォール ──
  const monthly = bySku.get(MONTHLY_SKU);
  const yearly = bySku.get(YEARLY_SKU);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heroIcon}>⭐</Text>
      <Text style={styles.title}>We育 プレミアム</Text>
      <Text style={styles.desc}>広告なしで、もっと快適に育児記録を。</Text>

      <View style={styles.benefits}>
        {BENEFITS.map((b) => (
          <View key={b.title} style={styles.benefitRow}>
            <Text style={styles.benefitIcon}>{b.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.benefitTitle}>{b.title}</Text>
              <Text style={styles.benefitDesc}>{b.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {!connected ? (
        <ActivityIndicator style={{ marginVertical: 24 }} color="#7C5CBF" />
      ) : (
        <>
          <TouchableOpacity
            style={[styles.planBtn, styles.planBtnPrimary]}
            disabled={busy}
            onPress={() => buy(YEARLY_SKU)}
          >
            <Text style={styles.planBtnBadge}>2か月分おトク</Text>
            <Text style={styles.planBtnTitle}>年額プラン</Text>
            <Text style={styles.planBtnPrice}>{yearly?.displayPrice ?? '¥5,000'} / 年</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.planBtn}
            disabled={busy}
            onPress={() => buy(MONTHLY_SKU)}
          >
            <Text style={styles.planBtnTitle}>月額プラン</Text>
            <Text style={styles.planBtnPrice}>{monthly?.displayPrice ?? '¥500'} / 月</Text>
          </TouchableOpacity>
        </>
      )}

      {busy && <ActivityIndicator style={{ marginTop: 8 }} color="#7C5CBF" />}

      <TouchableOpacity style={styles.restoreBtn} disabled={busy} onPress={restore}>
        <Text style={styles.restoreText}>購入の復元</Text>
      </TouchableOpacity>

      <Text style={styles.legalNote}>
        お支払いは{Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'}アカウントに請求されます。
        期間終了の24時間前までに解約しない限り自動更新されます。
        解約は{Platform.OS === 'ios' ? 'App Storeの設定' : 'Google Playの定期購入'}からいつでも行えます。
        どちらかの保護者が購入すると、同じ家族全員に適用されます。
      </Text>
      <View style={styles.legalLinks}>
        <TouchableOpacity onPress={() => navigation.navigate('Legal')}>
          <Text style={styles.legalLink}>利用規約</Text>
        </TouchableOpacity>
        <Text style={styles.legalDot}>・</Text>
        <TouchableOpacity onPress={() => Linking.openURL(`${getBaseUrl()}/legal`)}>
          <Text style={styles.legalLink}>プライバシーポリシー</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8FC' },
  content: { padding: 24, paddingBottom: 48, alignItems: 'stretch' },
  heroIcon: { fontSize: 44, textAlign: 'center', marginTop: 8 },
  title: { fontSize: 22, fontWeight: '900', color: '#805AAA', textAlign: 'center', marginTop: 8 },
  desc: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  canceledNote: { fontSize: 12, color: '#B45309', textAlign: 'center', marginTop: 12 },
  benefits: { marginTop: 24, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  benefitIcon: { fontSize: 24, marginRight: 12 },
  benefitTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  benefitDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  planBtn: {
    marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18,
    borderWidth: 2, borderColor: '#E9D5FF', alignItems: 'center',
  },
  planBtnPrimary: { borderColor: '#7C5CBF', borderWidth: 3, marginTop: 24 },
  planBtnBadge: {
    position: 'absolute', top: -10, backgroundColor: '#F59E0B', color: '#FFFFFF',
    fontSize: 11, fontWeight: '900', paddingHorizontal: 10, paddingVertical: 2,
    borderRadius: 10, overflow: 'hidden',
  },
  planBtnTitle: { fontSize: 15, fontWeight: '900', color: '#374151' },
  planBtnPrice: { fontSize: 18, fontWeight: '900', color: '#805AAA', marginTop: 4 },
  secondaryBtn: {
    marginTop: 24, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 2, borderColor: '#E9D5FF', alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: '#7C5CBF' },
  restoreBtn: { marginTop: 20, alignItems: 'center', padding: 8 },
  restoreText: { fontSize: 14, color: '#7C5CBF', fontWeight: '700' },
  legalNote: { fontSize: 11, color: '#9CA3AF', lineHeight: 17, marginTop: 16 },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  legalLink: { fontSize: 12, color: '#7C5CBF', textDecorationLine: 'underline' },
  legalDot: { fontSize: 12, color: '#9CA3AF' },
});
