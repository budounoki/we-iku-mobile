/**
 * 写真の撮影・選択と、アップロード用の JPEG 作成（毎日の1枚カレンダー）。
 *
 * expo-image-picker / expo-image-manipulator はネイティブモジュールのため、
 * 入っていない旧ビルドで import すると起動時に落ちる。PDF 書き出しと同じく、
 * 使う直前に require して、無ければ「最新版に更新」を案内する（OTA で配っても安全）。
 *
 * サーバーは本文の合計を 10MB までに制限し、受け取った画像を作り直して
 * EXIF/GPS を消す。ここでは送る前に長辺 2048px（サムネイル 400px）に縮めて JPEG にする。
 * iPhone の HEIC もこの変換で JPEG になる。
 */
import { Alert } from 'react-native';

export class PhotoPickerUnavailable extends Error {}

export type PreparedPhoto = {
  fullBase64: string;
  thumbBase64: string;
  takenAt: string | null;
  source: 'camera' | 'library';
  previewUri: string;
};

function loadModules() {
  try {
    return {
      ImagePicker: require('expo-image-picker'),
      Manipulator: require('expo-image-manipulator'),
    };
  } catch {
    throw new PhotoPickerUnavailable('写真の追加には、アプリを最新版に更新してください。');
  }
}

/** EXIF の撮影日時（オフセットが無ければ日本時間として読む）。 */
function takenAtFromExif(exif: Record<string, any> | null | undefined): string | null {
  const raw: unknown = exif?.DateTimeOriginal ?? exif?.DateTimeDigitized ?? exif?.DateTime;
  if (typeof raw !== 'string') return null;
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const offset = typeof exif?.OffsetTimeOriginal === 'string' && /^[+-]\d{2}:\d{2}$/.test(exif.OffsetTimeOriginal)
    ? exif.OffsetTimeOriginal : '+09:00';
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${offset}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * 撮影またはカメラロールから1枚選んで、送信用に整える。キャンセル時は null。
 * 権限が無い場合は案内を出して null を返す。
 */
export async function pickPhoto(source: 'camera' | 'library'): Promise<PreparedPhoto | null> {
  const { ImagePicker, Manipulator } = loadModules();

  const perm = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      source === 'camera' ? 'カメラを使えません' : '写真を選べません',
      '端末の「設定」アプリから、We育の' + (source === 'camera' ? 'カメラ' : '写真') + 'へのアクセスを許可してください。',
    );
    return null;
  }

  const options = { mediaTypes: ['images'], quality: 1, exif: source === 'library', allowsEditing: false };
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];

  const resize = async (max: number) => {
    const w = asset.width || max, h = asset.height || max;
    const scale = Math.min(1, max / Math.max(w, h));
    const actions = scale < 1 ? [{ resize: w >= h ? { width: Math.round(w * scale) } : { height: Math.round(h * scale) } }] : [];
    return Manipulator.manipulateAsync(asset.uri, actions, {
      compress: 0.85,
      format: Manipulator.SaveFormat.JPEG,
      base64: true,
    });
  };
  const full = await resize(2048);
  const thumb = await resize(400);
  if (!full.base64 || !thumb.base64) throw new Error('写真を読み込めませんでした。別の写真でお試しください。');

  return {
    fullBase64: full.base64,
    thumbBase64: thumb.base64,
    // カメラは今撮った時刻。カメラロールは EXIF の撮影日時（無ければ null）。
    takenAt: source === 'camera' ? new Date().toISOString() : takenAtFromExif(asset.exif),
    source,
    previewUri: thumb.uri,
  };
}
