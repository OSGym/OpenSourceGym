import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MySubscription, OccupancyResponse } from "@opengym/shared";
import { api } from "../lib/api";
import { QrGlyph } from "../components/icons";
import { colors, radius, spacing, type } from "../theme";
import { Button, Skeleton, StatusMessage } from "../ui";
import { errorMessage } from "../i18n/errors";
import { dateLocale } from "../i18n/format";

export function Home({
  userName,
  onOpenQr,
}: {
  userName: string;
  onOpenQr: () => void;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const locale = dateLocale(i18n.resolvedLanguage);
  const [subscription, setSubscription] = useState<MySubscription | null>(null);
  const [occupancy, setOccupancy] = useState<OccupancyResponse | null>(null);
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
  const [occupancyLoaded, setOccupancyLoaded] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(
    null,
  );
  const [occupancyError, setOccupancyError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [subscriptionResult, occupancyResult] = await Promise.allSettled([
      api<MySubscription>("/api/me/subscription"),
      api<OccupancyResponse>("/api/me/occupancy"),
    ]);

    if (subscriptionResult.status === "fulfilled") {
      setSubscription(subscriptionResult.value);
      setSubscriptionError(null);
    } else {
      setSubscriptionError(
        errorMessage(subscriptionResult.reason, t, "Üyelik bilgisi alınamadı."),
      );
    }
    setSubscriptionLoaded(true);

    if (occupancyResult.status === "fulfilled") {
      setOccupancy(occupancyResult.value);
      setOccupancyError(null);
    } else {
      setOccupancyError(
        errorMessage(occupancyResult.reason, t, "Doluluk bilgisi alınamadı."),
      );
    }
    setOccupancyLoaded(true);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const occupancyPercent =
    occupancy?.ratio != null
      ? Math.max(0, Math.min(100, Math.round(occupancy.ratio * 100)))
      : null;
  const occupancyTone =
    occupancyPercent == null
      ? colors.textSecondary
      : occupancyPercent > 90
        ? colors.error
        : occupancyPercent >= 70
          ? colors.warning
          : colors.success;
  const occupancySurface =
    occupancyPercent == null
      ? colors.surfaceRaised
      : occupancyPercent > 90
        ? colors.errorSurface
        : occupancyPercent >= 70
          ? colors.warningSurface
          : colors.successSurface;
  const occupancyLabel =
    occupancyPercent == null
      ? t("Bilinmiyor")
      : occupancyPercent > 90
        ? t("Yoğun")
        : occupancyPercent >= 70
          ? t("Orta yoğunluk")
          : t("Sakin");
  const firstName = userName.trim().split(/\s+/)[0] || t("Üye");
  const formatDate = (value?: string | null) =>
    value
      ? new Date(value).toLocaleDateString(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";

  return (
    <ScrollView
      style={home.screen}
      contentContainerStyle={[
        home.content,
        { paddingTop: insets.top + spacing.lg },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.textPrimary}
          colors={[colors.textPrimary]}
          progressBackgroundColor={colors.surfaceRaised}
        />
      }
    >
      <View style={home.header}>
        <Text style={home.kicker}>
          {t("Merhaba, {{name}}", { name: firstName })}
        </Text>
        <Text accessibilityRole="header" style={home.title}>
          {t("Bugün salonda")}
        </Text>
        <Text style={home.subtitle}>
          {t("Doluluğu kontrol et, üyeliğini gör ve turnikeden geç.")}
        </Text>
      </View>

      <View style={home.occupancySection}>
        <View style={home.sectionHeadingRow}>
          <Text style={home.sectionTitle}>{t("Salon doluluğu")}</Text>
          {occupancyLoaded && !occupancyError ? (
            <Text
              style={[
                home.badge,
                { color: occupancyTone, backgroundColor: occupancySurface },
              ]}
            >
              {occupancyLabel}
            </Text>
          ) : null}
        </View>

        {!occupancyLoaded ? (
          <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
            <Skeleton width={126} height={52} />
            <Skeleton height={8} radius={4} />
            <Skeleton width="58%" height={18} />
          </View>
        ) : occupancyError ? (
          <View style={{ marginTop: spacing.md }}>
            <StatusMessage
              text={occupancyError}
              actionLabel={t("Tekrar dene")}
              onAction={() => void load()}
            />
          </View>
        ) : (
          <>
            <View style={home.metricRow}>
              <Text style={home.metric}>
                {occupancyPercent ?? "—"}
                {occupancyPercent == null ? null : (
                  <Text style={home.metricUnit}>%</Text>
                )}
              </Text>
              <Text style={home.people}>
                {occupancy?.capacity != null
                  ? t("{{inside}} / {{capacity}} kişi içeride", {
                      inside: occupancy.inside,
                      capacity: occupancy.capacity,
                    })
                  : t("{{inside}} kişi içeride", {
                      inside: occupancy?.inside ?? 0,
                    })}
              </Text>
            </View>
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={t("Salon doluluğu")}
              accessibilityValue={{
                min: 0,
                max: 100,
                now: occupancyPercent ?? undefined,
                text: occupancyLabel,
              }}
              style={home.track}
            >
              <View
                style={[
                  home.fill,
                  {
                    width: `${occupancyPercent ?? 0}%`,
                    backgroundColor: occupancyTone,
                  },
                ]}
              />
            </View>
          </>
        )}
      </View>

      <Button
        title={t("Turnike QR kodunu tara")}
        onPress={onOpenQr}
        icon={<QrGlyph size={21} color={colors.onPrimary} />}
      />

      <View style={home.membershipSection}>
        <View style={home.sectionHeadingRow}>
          <Text style={home.sectionTitle}>{t("Üyeliğin")}</Text>
          {subscriptionLoaded && !subscriptionError ? (
            <Text
              style={[
                home.badge,
                subscription?.active ? home.activeBadge : home.inactiveBadge,
              ]}
            >
              {subscription?.active ? t("Aktif") : t("Pasif")}
            </Text>
          ) : null}
        </View>

        {!subscriptionLoaded ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
            <Skeleton height={24} width="72%" />
            <Skeleton height={56} />
          </View>
        ) : subscriptionError ? (
          <View style={{ marginTop: spacing.md }}>
            <StatusMessage
              text={subscriptionError}
              actionLabel={t("Tekrar dene")}
              onAction={() => void load()}
            />
          </View>
        ) : subscription?.active ? (
          <>
            <Text style={home.remaining}>
              {t("{{count}} gün kaldı", {
                count: subscription.remainingDays ?? 0,
              })}
            </Text>
            <View style={home.dateRow}>
              <View style={home.dateColumn}>
                <Text style={home.dateLabel}>{t("Başlangıç")}</Text>
                <Text style={home.dateValue}>
                  {formatDate(subscription.startsAt)}
                </Text>
              </View>
              <View style={home.divider} />
              <View style={home.dateColumn}>
                <Text style={home.dateLabel}>{t("Bitiş")}</Text>
                <Text style={home.dateValue}>
                  {formatDate(subscription.endsAt)}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <Text style={home.emptyMembership}>
            {t(
              "Aktif üyeliğin bulunmuyor. Salon resepsiyonundan destek alabilirsin.",
            )}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const home = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xxl,
  },
  header: { marginBottom: spacing.xl },
  kicker: { ...type.supporting, color: colors.textSecondary },
  title: {
    ...type.screenTitle,
    color: colors.textPrimary,
    marginTop: spacing.xxs,
  },
  subtitle: {
    ...type.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    maxWidth: 420,
  },
  occupancySection: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionHeadingRow: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sectionTitle: { ...type.title, color: colors.textPrimary },
  badge: {
    ...type.label,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    overflow: "hidden",
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  metric: { ...type.metric, color: colors.textPrimary, letterSpacing: -1 },
  metricUnit: { fontSize: 23, lineHeight: 29, fontWeight: "600" },
  people: { ...type.supporting, color: colors.textSecondary, flex: 1 },
  track: {
    height: 8,
    backgroundColor: colors.outline,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: spacing.md,
  },
  fill: { height: "100%", borderRadius: 4 },
  membershipSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
  },
  activeBadge: {
    color: colors.success,
    backgroundColor: colors.successSurface,
  },
  inactiveBadge: { color: colors.error, backgroundColor: colors.errorSurface },
  remaining: {
    ...type.sectionTitle,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.input,
  },
  dateColumn: { flex: 1, paddingHorizontal: spacing.md },
  divider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.outline },
  dateLabel: { ...type.label, color: colors.textTertiary },
  dateValue: { ...type.supporting, color: colors.textPrimary, marginTop: 3 },
  emptyMembership: {
    ...type.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
