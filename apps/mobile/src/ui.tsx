import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { colors } from "./theme";

export function Field(
  props: TextInputProps & { label: string },
) {
  const { label, ...inputProps } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.inkDim}
        {...inputProps}
        style={styles.input}
      />
    </View>
  );
}

export function Button({
  title,
  onPress,
  busy,
  ghost,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  ghost?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.button,
        ghost && styles.buttonGhost,
        pressed && { opacity: 0.85 },
        busy && { opacity: 0.5 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={ghost ? colors.ink : colors.accentInk} />
      ) : (
        <Text style={[styles.buttonText, ghost && { color: colors.ink }]}>
          {title.toUpperCase()}
        </Text>
      )}
    </Pressable>
  );
}

export function Checkbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <Pressable style={styles.checkboxRow} onPress={onToggle}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

export function ErrorMsg({ text }: { text: string | null }) {
  if (!text) return null;
  return <Text style={styles.error}>{text}</Text>;
}

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
    justifyContent: "center",
  },
  brand: {
    fontSize: 34,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  brandAccent: {
    color: colors.accent,
  },
  sub: {
    color: colors.inkDim,
    marginBottom: 24,
    fontSize: 13,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    color: colors.inkDim,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 5,
  },
  input: {
    backgroundColor: colors.bgRaise,
    borderWidth: 1,
    borderColor: colors.lineHard,
    color: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 8,
  },
  buttonGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.lineHard,
  },
  buttonText: {
    color: colors.accentInk,
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 1,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.lineHard,
    backgroundColor: colors.bgRaise,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: colors.accentInk,
    fontWeight: "900",
    fontSize: 14,
  },
  checkboxLabel: {
    color: colors.ink,
    flex: 1,
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: 10,
    marginBottom: 14,
    fontSize: 13,
  },
  link: {
    color: colors.inkDim,
    textAlign: "center",
    marginTop: 18,
    textDecorationLine: "underline",
    fontSize: 13,
  },
});
