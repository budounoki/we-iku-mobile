import { apiGet } from './client';

/**
 * キャンペーン（簡易版）の表示情報。表示してよいか・識別コード・フォームURLは
 * すべてサーバー（/api/campaign/current）が判定する。アプリ側では判定しない。
 */
export type CampaignInfo =
  | { show: false }
  | {
      show: true;
      title: string;
      subtitle: string;
      code: string;
      /** 識別コード付きの応募フォームURL。フォーム準備前（確認用表示）は null。 */
      url: string | null;
      endsAt: string;
    };

export function fetchCurrentCampaign(): Promise<CampaignInfo> {
  return apiGet<CampaignInfo>('/api/campaign/current');
}
