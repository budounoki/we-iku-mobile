/**
 * 寝かしつけ中（ネントレのタイマー・見守り中）をサーバーに伝える。
 * 作動中は毎分送り、サーバーは 2 時間有効として扱う（アプリが閉じられても安全側）。
 * 止めたら一度だけ「終了」を送る。写真のおしらせはこの間は送られず、30 分ごとに再判定される。
 * 睡眠記録（睡眠中）とは別物で、そちらには触れない。
 */
import { useEffect, useRef } from 'react';
import { reportSettling } from '../api/photoCalendar';

export function usePhotoSettling(settling: boolean) {
  const was = useRef(false);
  useEffect(() => {
    const send = () => { void reportSettling(settling).catch(() => {}); };
    if (settling || was.current) send();
    was.current = settling;
    if (!settling) return;
    const timer = setInterval(send, 60_000);
    return () => clearInterval(timer);
  }, [settling]);
}
