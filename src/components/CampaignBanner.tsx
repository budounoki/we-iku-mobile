/**
 * ホームのキャンペーンバナー（ぶどうの木宿泊券 2026・簡易版）。
 *
 * 表示可否はサーバーが判定する（期間・期間中の新規登録・ママ/パパ）。対象外なら
 * 何も描画しない。タップで識別コード付きの応募フォーム（Google フォーム）を
 * アプリ内ブラウザで開く。応募の受付・規約はフォーム側。
 */
import React from 'react';
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react-native';
import { Text } from '../theme/ui';
import { fonts, radius } from '../theme/tokens';
import { fetchCurrentCampaign } from '../api/campaign';

export default function CampaignBanner() {
  const { data } = useQuery({
    queryKey: ['campaign', 'current'],
    queryFn: fetchCurrentCampaign,
    // 期間の開始・終了をまたいでも表示が切り替わるよう、ほどほどに再取得する。
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (!data || !data.show) return null;

  const open = async () => {
    if (!data.url) {
      Alert.alert('応募フォーム準備中', `識別コード: ${data.code}`);
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(data.url);
    } catch {
      Alert.alert('エラー', '応募フォームを開けませんでした。時間をおいてお試しください。');
    }
  };

  return (
    <View style={s.wrap}>
      <TouchableOpacity style={s.banner} onPress={open} activeOpacity={0.85} accessibilityRole="button">
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{data.title}</Text>
          <Text style={s.subtitle}>{data.subtitle}</Text>
        </View>
        <ChevronRight size={20} color="#7C3AED" strokeWidth={2.5} />
      </TouchableOpacity>
      {/* App Store / Google Play の規約上、懸賞にはスポンサーでない旨の表記が必要。 */}
      <Text style={s.disclaimer}>
        本キャンペーンは株式会社Grapeが主催するものです。Apple Inc.およびGoogle LLCは本キャンペーンのスポンサーではありません。
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 12 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5EEFF',
    borderColor: '#D8C4F5',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  title: { fontSize: 15, fontFamily: fonts.bodyBold, fontWeight: '800', color: '#4C1D95' },
  subtitle: { fontSize: 12, color: '#6B5B8A', marginTop: 3 },
  disclaimer: { fontSize: 10, color: '#9CA3AF', marginTop: 6, lineHeight: 14 },
});
