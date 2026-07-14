import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme";
import { setLanguage } from "./index";

export function LanguageSwitcher({ floating = false }: { floating?: boolean }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const active = i18n.resolvedLanguage?.startsWith("tr") ? "tr" : "en";

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.container,
        floating && styles.floating,
        floating && { top: insets.top + 12 },
      ]}
    >
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel={t("Dili Türkçe yap")}
        accessibilityState={{ selected: active === "tr" }}
        style={({ pressed }) => [
          styles.optionButton,
          active === "tr" && styles.optionButtonActive,
          pressed && styles.pressed,
        ]}
        onPress={() => void setLanguage("tr")}
      >
        <Text style={[styles.option, active === "tr" && styles.active]}>
          Türkçe
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel={t("Dili İngilizce yap")}
        accessibilityState={{ selected: active === "en" }}
        style={({ pressed }) => [
          styles.optionButton,
          active === "en" && styles.optionButtonActive,
          pressed && styles.pressed,
        ]}
        onPress={() => void setLanguage("en")}
      >
        <Text style={[styles.option, active === "en" && styles.active]}>
          English
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    padding: 3,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
  },
  floating: {
    position: "absolute",
    zIndex: 20,
    right: 20,
  },
  optionButton: {
    minHeight: 38,
    minWidth: 72,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  optionButtonActive: {
    backgroundColor: colors.primaryMuted,
  },
  option: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: "600",
  },
  active: {
    color: colors.textPrimary,
  },
  pressed: { opacity: 0.7 },
});
