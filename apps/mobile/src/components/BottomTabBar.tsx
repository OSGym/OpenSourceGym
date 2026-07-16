import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing, type } from "../theme";
import { DashboardGlyph, PersonGlyph, QrGlyph } from "./icons";

export type AppTab = "home" | "scan" | "profile";

const tabs: Array<{
  id: AppTab;
  label: "Ana Sayfa" | "QR Tara" | "Profil";
  icon: typeof DashboardGlyph;
}> = [
  { id: "home", label: "Ana Sayfa", icon: DashboardGlyph },
  { id: "scan", label: "QR Tara", icon: QrGlyph },
  { id: "profile", label: "Profil", icon: PersonGlyph },
];

export function BottomTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]}
    >
      {tabs.map((tab) => {
        const selected = tab.id === activeTab;
        const Icon = tab.icon;
        const color = selected ? colors.textPrimary : colors.textTertiary;

        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={t(tab.label)}
            accessibilityState={{ selected }}
            onPress={() => onTabChange(tab.id)}
            style={({ pressed }) => [
              styles.item,
              selected && styles.itemSelected,
              pressed && styles.pressed,
            ]}
          >
            <Icon size={21} color={color} />
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {t(tab.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingTop: 8,
    paddingHorizontal: spacing.sm,
  },
  item: {
    flex: 1,
    minHeight: 54,
    borderRadius: radius.input,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  itemSelected: { backgroundColor: colors.primaryMuted },
  label: {
    ...type.label,
    color: colors.textTertiary,
    fontSize: 12,
    lineHeight: 16,
  },
  labelSelected: { color: colors.textPrimary },
  pressed: { opacity: 0.68 },
});
