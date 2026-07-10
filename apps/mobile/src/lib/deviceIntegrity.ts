import * as Device from "expo-device";

export type DeviceIntegrityResult = {
  compromised: boolean;
  reasons: string[];
};

// Prod derlemelerde varsayılan açık, __DEV__ altında (emülatör/Expo Go yanlış
// pozitiflerini önlemek için) varsayılan kapalı. EXPO_PUBLIC_ANTI_DEBUG=1/0 ile zorlanabilir.
const enabled =
  (process.env.EXPO_PUBLIC_ANTI_DEBUG ?? (__DEV__ ? "0" : "1")) === "1";

export async function checkDeviceIntegrity(): Promise<DeviceIntegrityResult> {
  if (!enabled) {
    return { compromised: false, reasons: [] };
  }

  const reasons: string[] = [];

  try {
    if (await Device.isRootedExperimentalAsync()) {
      reasons.push("root");
    }
  } catch {
    // Kontrol başarısız oldu — pozitif sinyal sayılmaz (fail-open).
  }

  try {
    if (!Device.isDevice) {
      reasons.push("emulator");
    }
  } catch {
    // Kontrol başarısız oldu — pozitif sinyal sayılmaz (fail-open).
  }

  try {
    if (__DEV__) {
      reasons.push("dev-bundle");
    }
  } catch {
    // Kontrol başarısız oldu — pozitif sinyal sayılmaz (fail-open).
  }

  return { compromised: reasons.length > 0, reasons };
}
