import Constants from "expo-constants";

/**
 * API adresi çözümü:
 * 1. EXPO_PUBLIC_API_URL env değişkeni (öncelikli)
 * 2. Metro'nun çalıştığı makinenin adresi (hostUri) + API portu —
 *    LAN üzerindeki gerçek cihaz ve emülatör için çalışır
 * 3. localhost (adb reverse tcp:3000 tcp:3000 gerektirir)
 */
const devHost = Constants.expoConfig?.hostUri?.split(":")[0];

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (devHost ? `http://${devHost}:3000` : "http://localhost:3000");
