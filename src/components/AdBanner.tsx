import React, { useEffect, useState } from 'react';
import { Platform, View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
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
  const navigation = useNavigation<any>();

  useEffect(() => {
    if (!adFree) initMobileAds();
  }, [adFree]);

  // premium / free_forever（モニター家族）/ プラン判定中 / 未ログインは何も出さない。
  if (adFree || !user) return null;

  const unitId = bannerUnitId();
  // バナーは読み込み成功時のみ表示（失敗・ライブラリ未リンク・ID未設定時は枠を出さない）。
  const showBanner = !failed && !!BannerAd && !!unitId;

  return (
    <View style={{ alignItems: 'center', backgroundColor: 'transparent' }}>
      {showBanner && (
        <BannerAd
          unitId={unitId!}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdFailedToLoad={() => setFailed(true)}
        />
      )}
      {/* バナー直下の「広告を消す」導線。広告枠の外側・中央寄せ・小さめグレー
          文字（下線付き）で、広告の閉じるボタンとは誤認されない見た目にする。
          無料プラン家族にプレミアムへの入口を常に提示する（クライアント要望
          2026-10：設定内だけだと誰もプレミアムに気づかない恐れがあるため）。 */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Premium')}
        hitSlop={{ top: 6, bottom: 6, left: 16, right: 16 }}
        style={{ paddingVertical: 4, paddingHorizontal: 12, cursor: 'pointer' }}
      >
        {/* 以前は #9CA3AF で背景と同系色になり見えづらかった（client 2026-10）。
            ブランド紫＋下線＋やや太字で、タップできる導線として読みやすくする。 */}
        <Text style={{ fontSize: 12, color: '#7C3AED', fontWeight: '600', textDecorationLine: 'underline' }}>
          広告を消す
        </Text>
      </TouchableOpacity>
    </View>
  );
}
