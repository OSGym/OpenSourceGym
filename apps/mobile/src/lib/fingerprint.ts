import { Platform } from "react-native";
import * as Application from "expo-application";
import * as Device from "expo-device";
import * as Crypto from "expo-crypto";

const FINGERPRINT_RE = /^[a-f0-9]{64}$/;

let fingerprintPromise: Promise<string | null> | null = null;

async function computeFingerprint(): Promise<string | null> {
  try {
    let stableId: string | null = null;
    if (Platform.OS === "android") {
      stableId = Application.getAndroidId();
    } else if (Platform.OS === "ios") {
      stableId = await Application.getIosIdForVendorAsync();
    } else {
      // Diğer platformlarda (web vb.) parmak izi desteklenmiyor.
      return null;
    }
    if (!stableId) return null;

    const raw = `${Platform.OS}:${stableId}:${Device.modelId ?? Device.modelName ?? ""}`;
    // Ham cihaz kimlikleri bu fonksiyonun dışına asla çıkmaz; sadece hash gönderilir.
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      raw,
    );
    const hex = digest.toLowerCase();
    return FINGERPRINT_RE.test(hex) ? hex : null;
  } catch {
    // Parmak izi çıkarma başarısız olursa uygulamayı asla engelleme.
    return null;
  }
}

/**
 * Cihaza özgü, geri döndürülemez bir parmak izi (SHA-256 hex) üretir.
 * Başarılı sonuç uygulama oturumu boyunca önbelleğe alınır; `null` (geçici
 * hata, izin vb.) önbelleğe ALINMAZ — sonraki çağrı yeniden dener.
 * Hata durumunda `null` döner (fail-open) — çağıranlar bunu opsiyonel kabul etmeli.
 */
export function getDeviceFingerprint(): Promise<string | null> {
  if (!fingerprintPromise) {
    fingerprintPromise = computeFingerprint().then((fp) => {
      if (fp === null) fingerprintPromise = null;
      return fp;
    });
  }
  return fingerprintPromise;
}
