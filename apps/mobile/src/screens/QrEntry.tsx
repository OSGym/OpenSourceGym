import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import QRCode from "react-native-qrcode-svg";
import type { QrTokenResponse } from "@opengym/shared";
import { ApiError, api } from "../lib/api";
import { colors } from "../theme";
import { Button } from "../ui";

// Sunucu token'ı 60 sn geçerli tutuyor; süresi dolmadan bu kadar önce yenile.
const RELOAD_MARGIN_MS = 5000;

export function QrEntry({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<QrTokenResponse | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearTimers = useCallback(() => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
    if (reloadTimer.current) {
      clearTimeout(reloadTimer.current);
      reloadTimer.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    clearTimers();
    setLoading(true);
    setError(null);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      let mocked: boolean | undefined;
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (granted) {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          mocked = pos.mocked === true;
        }
      } catch {
        // Konum alınamadı — sunucu konumsuz devam edilip edilemeyeceğine karar verir.
      }

      const body =
        lat !== undefined && lng !== undefined ? { lat, lng, mocked } : {};
      const res = await api<QrTokenResponse>("/api/me/qr-token", {
        method: "POST",
        body,
      });
      if (!mountedRef.current) return;
      setData(res);

      const expiresAtMs = new Date(res.expiresAt).getTime();
      const tick = () => {
        const left = Math.max(0, Math.round((expiresAtMs - Date.now()) / 1000));
        setSecondsLeft(left);
      };
      tick();
      countdownTimer.current = setInterval(tick, 1000);

      const msUntilReload = Math.max(
        0,
        expiresAtMs - Date.now() - RELOAD_MARGIN_MS,
      );
      reloadTimer.current = setTimeout(() => {
        void load();
      }, msUntilReload);
    } catch (err) {
      if (!mountedRef.current) return;
      setData(null);
      if (err instanceof ApiError) {
        setError({ message: err.message, code: err.code });
      } else {
        setError({ message: "QR alınamadı. Tekrar deneyin." });
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [clearTimers]);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, [load, clearTimers]);

  return (
    <View style={qr.screen}>
      <Text style={qr.title}>GİRİŞ QR</Text>

      {loading && !data ? (
        <View style={qr.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : error ? (
        <View style={qr.card}>
          <Text style={qr.errorText}>{error.message}</Text>
          {error.code === "LOCATION_REQUIRED" && (
            <Text style={qr.hint}>
              Uygulamaya konum izni vermeniz gerekebilir.
            </Text>
          )}
          {error.code === "MOCK_LOCATION" && (
            <Text style={qr.hint}>
              Sahte konum uygulamasını (mock location) kapatıp tekrar deneyin.
            </Text>
          )}
          {error.code === "SHARING_BLOCKED" && (
            <Text style={qr.hint}>
              Hesap paylaşımı şüphesi nedeniyle geçici engel. Sorun olduğunu
              düşünüyorsanız resepsiyona başvurun.
            </Text>
          )}
          <Button title="Tekrar dene" onPress={() => void load()} />
        </View>
      ) : data ? (
        <>
          {data.gatewayOnline === false && (
            <View style={qr.banner}>
              <Text style={qr.bannerText}>
                Turnike bağlantısı şu an yok. Resepsiyona başvurun.
              </Text>
            </View>
          )}
          <View style={qr.qrBox}>
            <QRCode value={data.token} size={240} />
          </View>
          <Text style={qr.countdown}>{secondsLeft} sn</Text>
          <Text style={qr.detail}>Bu kod kısa süre sonra yenilenecek.</Text>
        </>
      ) : null}

      <View style={qr.spacer} />
      <Button title="Geri" ghost onPress={onBack} />
    </View>
  );
}

const qr = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
    paddingTop: 70,
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 24,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 20,
  },
  errorText: {
    color: colors.danger,
    fontSize: 15,
    marginBottom: 10,
  },
  hint: {
    color: colors.inkDim,
    fontSize: 13,
    marginBottom: 16,
  },
  banner: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: 14,
    marginBottom: 20,
  },
  bannerText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  qrBox: {
    backgroundColor: "#ffffff",
    alignSelf: "center",
    padding: 20,
    borderRadius: 16,
  },
  countdown: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 24,
  },
  detail: {
    color: colors.inkDim,
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
  },
  spacer: {
    flex: 1,
  },
});
