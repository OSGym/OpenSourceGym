import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius } from "../theme";

const CELL_COUNT = 6;

/**
 * Altı hücre tek bir görünmez sayısal TextInput tarafından yönetilir. Bir
 * hücreye dokunmak girdiyi odaklar; imlecin bulunduğu hücre etkin kenarlığı
 * alır.
 */
export function OtpInput({
  value,
  onChangeText,
  autoFocus,
  error,
}: {
  value: string;
  onChangeText: (text: string) => void;
  autoFocus?: boolean;
  error?: string | null;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<TextInput>(null);
  const activeIndex = Math.min(value.length, CELL_COUNT - 1);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{t("Doğrulama kodu")}</Text>
      <Pressable
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.row}
        onPress={() => inputRef.current?.focus()}
      >
        {Array.from({ length: CELL_COUNT }).map((_, index) => {
          const digit = value[index] ?? "";
          const active = index === activeIndex;
          return (
            <View
              key={index}
              style={[
                styles.cell,
                active && styles.cellActive,
                error && styles.cellError,
              ]}
            >
              <Text style={styles.digit}>{digit}</Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        accessibilityLabel={t("Doğrulama kodu")}
        accessibilityHint={error ?? undefined}
        ref={inputRef}
        value={value}
        onChangeText={(text) =>
          onChangeText(text.replace(/[^0-9]/g, "").slice(0, CELL_COUNT))
        }
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CELL_COUNT}
        autoFocus={autoFocus}
        caretHidden
        style={styles.hiddenInput}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { width: "100%", gap: 7 },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  cell: {
    flex: 1,
    maxWidth: 52,
    height: 56,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceInput,
    alignItems: "center",
    justifyContent: "center",
  },
  cellActive: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.textPrimary,
  },
  cellError: { borderColor: colors.error },
  digit: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.ink,
  },
  hiddenInput: {
    position: "absolute",
    top: 25,
    left: 0,
    right: 0,
    height: 56,
    opacity: 0,
  },
  error: { color: colors.error, fontSize: 14, lineHeight: 20 },
});
