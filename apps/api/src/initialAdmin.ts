export const INITIAL_ADMIN_EMAIL = "admin@opengym.local";
export const INITIAL_ADMIN_PASSWORD = "admin1234";

// Gerçek bir üyeye ait olabilecek telefon numarasını rezerve etmemek için ilk
// kurulum hesabı bu dahili sentineli kullanır. Yalnızca başlangıç hook'undaki
// e-posta + telefon eşleşmesi bu değeri kabul eder.
export const INITIAL_ADMIN_PHONE = "-";

let seedInProgress = false;

/**
 * Sentinel telefon yalnız sunucu dinlemeye başlamadan çalışan dahili seed
 * çağrısında kabul edilir. E-posta/telefon değerlerini bilen bir HTTP istemcisi
 * bu kapsamı etkinleştiremez.
 */
export async function runAsInitialAdminSeed<T>(
  operation: () => Promise<T>,
): Promise<T> {
  if (seedInProgress) {
    throw new Error("İlk admin seed işlemi zaten çalışıyor.");
  }
  seedInProgress = true;
  try {
    return await operation();
  } finally {
    seedInProgress = false;
  }
}

export function isInitialAdminSeedInput(
  email: unknown,
  phone: unknown,
): boolean {
  return (
    seedInProgress &&
    email === INITIAL_ADMIN_EMAIL &&
    phone === INITIAL_ADMIN_PHONE
  );
}
