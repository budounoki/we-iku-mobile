import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * ボトムシート型ダイアログの overlay（justifyContent:'flex-end' の背景）に入れるべき
 * paddingBottom（px）を返す。これでシートがキーボードや Android のナビゲーションバーに
 * 隠れないように持ち上げられる。
 *
 * - RN の <Modal> 内では KeyboardAvoidingView が効かない（iOS）ため、キーボード高さを
 *   自前で測って持ち上げる（client 2026-10: 通院が記録しにくい）。Android の Modal も
 *   windowSoftInputMode=resize の対象外なので同様に自前で持ち上げる。
 * - キーボードが無いときは、Android のナビゲーションバー分だけ余白を確保して、保存ボタンが
 *   下部メニューに隠れないようにする（client 2026-10: おくすり記録のボタンが隠れる）。
 *   iOS は各カードが home indicator 分の paddingBottom を持っているので 0。
 */

/**
 * キーボードが閉じたときに paddingBottom を 0 に戻すまでの遅延（ms）。
 *
 * 0 に戻すとシートがキーボード高さ分（約300px）一気に下がる。「記録する」を押した
 * 指が触れている間にこれが起きると、ボタンが指の下から移動して TouchableOpacity が
 * 押下をキャンセルし、1回目が無反応＝2回押す必要が出る
 * （client 2026-10: 散歩・通院のメモ欄入力時に2回「記録する」を押す必要がある）。
 * タップの押下〜離しは通常 100ms 程度なので、少し待ってから戻せば取り消されない。
 */
const HIDE_COLLAPSE_DELAY_MS = 250;

/**
 * キーボードが実際に表示されているかどうか。
 *
 * useKeyboardHeight は Android ではキーボードが無くてもナビゲーションバー分を
 * 返すため、「高さ > 0」では表示中かを判定できない。また Android では
 * キーボードを閉じても TextInput のフォーカスは外れないので、フォーカスの
 * 有無でも判定できない（client 2026-10: キーボードが消えた後に空白が残る）。
 * 余白の出し入れはこの値で判定する。
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvt, () => setVisible(true));
    const subHide = Keyboard.addListener(hideEvt, () => setVisible(false));
    return () => { subShow.remove(); subHide.remove(); };
  }, []);
  return visible;
}

/**
 * キーボード上端の画面Y座標。非表示のときは 0。
 *
 * 高さや「ウィンドウが縮んだか」から位置を推測すると、広告バナーの読み込みなど
 * 別の理由でも高さが変わるため当てにならない。endCoordinates.screenY は
 * キーボード上端そのものなので、入力欄の実測位置と直接比較できる。
 */
export function useKeyboardTop(): number {
  const [top, setTop] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvt, (e: any) => setTop(e?.endCoordinates?.screenY ?? 0));
    const subHide = Keyboard.addListener(hideEvt, () => setTop(0));
    return () => { subShow.remove(); subHide.remove(); };
  }, []);
  return top;
}

export function useKeyboardHeight(): number {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const clearHideTimer = () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };

    const subShow = Keyboard.addListener(showEvt, (e: any) => {
      clearHideTimer();
      setHeight(e?.endCoordinates?.height ?? 0);
    });
    const subHide = Keyboard.addListener(hideEvt, () => {
      clearHideTimer();
      hideTimer.current = setTimeout(() => {
        hideTimer.current = null;
        setHeight(0);
      }, HIDE_COLLAPSE_DELAY_MS);
    });

    return () => {
      clearHideTimer();
      subShow.remove();
      subHide.remove();
    };
  }, []);

  // キーボードが出ていないとき: Android はナビゲーションバー分だけ確保、iOS は 0。
  if (height <= 0) return Platform.OS === 'android' ? insets.bottom : 0;
  // キーボードが出ているとき: その高さ分（＋ Android は上部ツールバー分の余白）持ち上げる。
  return height + (Platform.OS === 'android' ? 44 : 8);
}
