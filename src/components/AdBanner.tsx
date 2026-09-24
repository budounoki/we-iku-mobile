import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { usePlan } from '../hooks/usePlan';

/**
 * 無料プラン家族向けのバナー広告（タブバー直上に常設）。
 * - premium / free_forever（モニター家族）/ プラン判定中は何も描画しない。
 * - 個別化されない広告のみ配信（requestNonPersonalizedAdsOnly）なので
 *   iOSのATTプロンプトは不要。
 * - 広告ユニットIDは EXPO_PUBLIC_ADMOB_BANNER_(IOS|ANDROID) で注入し、
 *   未設定のビルド（開発・クライアントのID受領前）はGoogleのテストIDを使う。
 */

// ネイティブ専用モジュールなので web バンドルでは読み込まない。
let BannerAd: any = null;
let BannerAdSize: any = null;
let TestIds: any = null;
if (Platform.OS !== 'web') {
  try {
    const ads = require('react-native-google-mobile-ads');
    BannerAd = ads.BannerAd;
    BannerAdSize = ads.BannerAdSize;
    TestIds = ads.TestIds;
  } catch {
    // ライブラリ未リンクのビルド（Expo Goなど）ではバナーを出さない。
  }
}

let initialized = false;
async function initMobileAds() {
  if (initialized || Platform.OS === 'web') return;
  initialized = true;
  try {
    const ads = require('react-native-google-mobile-ads');
    await ads.default().initialize();
  } catch {
    // 初期化失敗時は各バナーの読み込みが失敗するだけで、アプリ動作には影響しない。
  }
}

function bannerUnitId(): string | null {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS || TestIds?.ADAPTIVE_BANNER || null;
  }
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID || TestIds?.ADAPTIVE_BANNER || null;
  }
  return null;
}

export default function AdBanner() {
  const user = useAuthStore((s) => s.user);
  const { adFree } = usePlan(user?.familyId ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!adFree) initMobileAds();
  }, [adFree]);

  if (adFree || failed || !BannerAd || !user) return null;
  const unitId = bannerUnitId();
  if (!unitId) return null;

  return (
    <View style={{ alignItems: 'center', backgroundColor: 'transparent' }}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}
