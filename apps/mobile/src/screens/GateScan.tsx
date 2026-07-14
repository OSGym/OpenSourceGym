import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import type { GateScanResponse } from "@opengym/shared";
import { ApiError, api } from "../lib/api";
import { colors, radius, spacing, type } from "../theme";
import { Button, StatusMessage } from "../ui";
import { errorMessage } from "../i18n/errors";

type ScanState =
  | { kind: "scanning" }
  | { kind: "validating" }
  | { kind: "success"; data: GateScanResponse }
  | { kind: "denied"; message: string; code?: string };

const GATE_QR_PREFIX = "OGGATE1.";
const RESCAN_DELAY_MS = 2500;

export function GateScan() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>({ kind: "scanning" });
  const busyRef = useRef(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetToScanning = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = null;
    busyRef.current = false;
    setState({ kind: "scanning" });
  }, []);

  useEffect(
    () => () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    },
    [],
  );

  const notifyResult = useCallback((success: boolean) => {
    requestAnimationFrame(() => {
      void Haptics.notificationAsync(
        success
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      ).catch(() => undefined);
    });
  }, []);

  const onBarcodeScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      if (busyRef.current || !result.data.startsWith(GATE_QR_PREFIX)) return;

      busyRef.current = true;
      setState({ kind: "validating" });

      let lat: number | undefined;
      let lng: number | undefined;
      let mocked: boolean | undefined;
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (granted) {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = position.coords.latitude;
          lng = position.coords.longitude;
          mocked = position.mocked === true;
        }
      } catch {
        // Konumsuz geçişe izin verilip verilmeyeceğine API karar verir.
      }

      try {
        const body =
          lat !== undefined && lng !== undefined
            ? { qr: result.data, lat, lng, mocked }
            : { qr: result.data };
        const response = await api<GateScanResponse>("/api/me/gate-scan", {
          method: "POST",
          body,
        });
        setState({ kind: "success", data: response });
        notifyResult(true);
        resetTimerRef.current = setTimeout(resetToScanning, RESCAN_DELAY_MS);
      } catch (error) {
        if (error instanceof ApiError) {
          setState({
            kind: "denied",
            message: errorMessage(
              error,
              t,
              "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
            ),
            code: error.code,
          });
        } else {
          setState({
            kind: "denied",
            message: t("Bağlantı hatası. Tekrar deneyin."),
          });
        }
        notifyResult(false);
      }
    },
    [notifyResult, resetToScanning, t],
  );

  if (!permission) {
    return (
      <View style={scan.center}>
        <ActivityIndicator color={colors.textPrimary} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    const canAskAgain = permission.canAskAgain !== false;
    return (
      <View
        style={[scan.permissionScreen, { paddingTop: insets.top + spacing.xl }]}
      >
        <Text accessibilityRole="header" style={scan.screenTitle}>
          {t("QR Tara")}
        </Text>
        <View style={scan.permissionCard}>
          <View style={scan.permissionIcon}>
            <Text style={scan.permissionIconText}>QR</Text>
          </View>
          <Text style={scan.resultTitle}>{t("Kamera erişimi gerekli")}</Text>
          <Text style={scan.resultDetail}>
            {t("Turnikedeki QR kodunu okutmak için kamera erişimi gerekir.")}
          </Text>
          <Button
            title={canAskAgain ? t("İzin ver") : t("Ayarları aç")}
            onPress={() =>
              canAskAgain
                ? void requestPermission()
                : void Linking.openSettings()
            }
          />
        </View>
      </View>
    );
  }

  const scanning = state.kind === "scanning" || state.kind === "validating";

  return (
    <View style={[scan.screen, { paddingTop: insets.top + spacing.lg }]}>
      <View style={scan.header}>
        <Text accessibilityRole="header" style={scan.screenTitle}>
          {t("QR Tara")}
        </Text>
        <Text style={scan.screenSubtitle}>
          {t("Kamerayı turnikedeki OpenGym koduna doğrult.")}
        </Text>
      </View>

      {scanning ? (
        <>
          <View style={scan.cameraFrame}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={
                state.kind === "scanning"
                  ? (result) => void onBarcodeScanned(result)
                  : undefined
              }
            />
            <View style={scan.cameraShade} pointerEvents="none" />
            <View style={scan.finder} pointerEvents="none">
              <View style={[scan.corner, scan.cornerTopLeft]} />
              <View style={[scan.corner, scan.cornerTopRight]} />
              <View style={[scan.corner, scan.cornerBottomLeft]} />
              <View style={[scan.corner, scan.cornerBottomRight]} />
            </View>
            {state.kind === "validating" ? (
              <View style={scan.validatingOverlay}>
                <ActivityIndicator color={colors.onPrimary} />
                <Text style={scan.validatingText}>
                  {t("Giriş doğrulanıyor…")}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={scan.scanHint}>
            {state.kind === "validating"
              ? t("Kodu kontrol ediyoruz, kısa bir an bekle.")
              : t("Kod algılandığında doğrulama otomatik başlar.")}
          </Text>
        </>
      ) : state.kind === "success" ? (
        <View style={scan.resultPanel}>
          <View style={[scan.resultIcon, scan.resultIconSuccess]}>
            <Text style={[scan.resultIconText, { color: colors.success }]}>
              ✓
            </Text>
          </View>
          <Text style={scan.resultTitle}>{t("Turnike açıldı")}</Text>
          <Text style={scan.resultDetail}>
            {t("{{device}} için {{direction}} kaydı oluşturuldu.", {
              device: state.data.deviceName,
              direction:
                state.data.direction === "out" ? t("çıkış") : t("giriş"),
            })}
          </Text>
          <StatusMessage
            tone="success"
            text={t("Yeni tarama için kamera birazdan yeniden açılacak.")}
          />
        </View>
      ) : (
        <View style={scan.resultPanel}>
          <View style={[scan.resultIcon, scan.resultIconError]}>
            <Text style={[scan.resultIconText, { color: colors.error }]}>
              !
            </Text>
          </View>
          <Text style={scan.resultTitle}>{t("Geçiş tamamlanamadı")}</Text>
          <Text style={scan.resultDetail}>{state.message}</Text>
          <RecoveryHint code={state.code} />
          <Button title={t("Tekrar tara")} onPress={resetToScanning} />
        </View>
      )}
    </View>
  );
}

function RecoveryHint({ code }: { code?: string }) {
  const { t } = useTranslation();
  const text =
    code === "LOCATION_REQUIRED"
      ? t("Konum iznini etkinleştirip tekrar deneyin.")
      : code === "MOCK_LOCATION"
        ? t("Sahte konum uygulamasını kapatıp tekrar deneyin.")
        : code === "SHARING_BLOCKED"
          ? t("Hesap paylaşımı engeli için salon resepsiyonuna başvurun.")
          : code === "DEVICE_OFFLINE"
            ? t("Turnike çevrimdışı. Salon resepsiyonundan yardım isteyin.")
            : t("Sorun sürerse salon resepsiyonundan destek alın.");

  return <StatusMessage tone="neutral" text={text} />;
}

const scan = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xl,
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  header: { marginBottom: spacing.xl },
  screenTitle: { ...type.screenTitle, color: colors.textPrimary },
  screenSubtitle: {
    ...type.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  permissionCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  permissionIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.card,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  permissionIconText: { ...type.label, color: colors.textPrimary },
  cameraFrame: {
    width: "100%",
    maxWidth: 520,
    aspectRatio: 1,
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  cameraShade: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.14)",
  },
  finder: {
    position: "absolute",
    width: "66%",
    aspectRatio: 1,
    alignSelf: "center",
    top: "17%",
  },
  corner: {
    position: "absolute",
    width: 36,
    height: 36,
    borderColor: colors.textPrimary,
  },
  cornerTopLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTopRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  validatingOverlay: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    minHeight: 54,
    borderRadius: radius.control,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  validatingText: { ...type.label, color: colors.onPrimary },
  scanHint: {
    ...type.supporting,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.md,
  },
  resultPanel: {
    flex: 1,
    justifyContent: "center",
    alignItems: "stretch",
    paddingHorizontal: spacing.md,
  },
  resultIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  resultIconSuccess: { backgroundColor: colors.successSurface },
  resultIconError: { backgroundColor: colors.errorSurface },
  resultIconText: { fontSize: 30, fontWeight: "700" },
  resultTitle: {
    ...type.sectionTitle,
    color: colors.textPrimary,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  resultDetail: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
});
