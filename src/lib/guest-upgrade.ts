/**
 * ゲストから LINE・Google・Apple のアカウントへの切り替え（記録の引き継ぎつき）。
 *
 * ゲストはサーバーにアカウントが無く、家族コード（familyId）だけで記録を読み書きしている。
 * 写真カレンダーなど本人確認が必要な機能は使えないため、ログインを案内する。
 * そのとき、ゲストの家族コードを端末に控えておき、ログイン直後に新しいアカウントを
 * その家族に参加させる。これで赤ちゃんや記録はそのまま残る。
 *
 * 既に記録のあるアカウントでログインした場合は、そのアカウントの家族を優先し、
 * 勝手に家族を移さない（引き継ぎ用の控えは消す）。
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getChildren } from '../api/children';
import { joinFamily, updateRole } from '../api/auth';

const CARRY_FAMILY_KEY = 'guestCarryFamilyId';
const CARRY_ROLE_KEY = 'guestCarryRole';

export async function isGuestSession(): Promise<boolean> {
  return (await AsyncStorage.getItem('sessionToken')) === 'guest';
}

/** ログイン画面へ移る前に、ゲストの家族コードと役割を控える。 */
export async function rememberGuestFamily(familyId: string, role: string) {
  await AsyncStorage.multiSet([[CARRY_FAMILY_KEY, familyId], [CARRY_ROLE_KEY, role]]);
}

export async function forgetGuestFamily() {
  await AsyncStorage.multiRemove([CARRY_FAMILY_KEY, CARRY_ROLE_KEY]);
}

/**
 * ログイン直後に呼ぶ（トークン保存後）。新しいアカウントにまだ赤ちゃんがいなければ
 * ゲストの家族に参加させ、引き継いだ家族コードと役割を返す。引き継がなければ null。
 */
export async function carryGuestFamily(
  currentFamilyId: string,
): Promise<{ familyId: string; role: 'papa' | 'mama' | null } | null> {
  const [[, guestFamilyId], [, guestRole]] = await AsyncStorage.multiGet([CARRY_FAMILY_KEY, CARRY_ROLE_KEY]);
  if (!guestFamilyId) return null;
  await AsyncStorage.multiRemove([CARRY_FAMILY_KEY, CARRY_ROLE_KEY]);
  if (guestFamilyId === currentFamilyId) return null;
  try {
    const own = await getChildren(currentFamilyId);
    if (own.length > 0) return null;
    await joinFamily(guestFamilyId);
    const role = guestRole === 'papa' || guestRole === 'mama' ? guestRole : null;
    if (role) await updateRole(role).catch(() => {});
    return { familyId: guestFamilyId, role };
  } catch {
    return null;
  }
}
