import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { useTranslation } from "react-i18next";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, gradients, motion, radius, spacing, type } from "./theme";
import authArtwork from "../assets/auth-equipment.webp";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => subscription.remove();
  }, []);

  return reduced;
}

export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size * (radius.control / 48),
        backgroundColor: colors.gradientEnd,
        experimental_backgroundImage: gradients.squircle,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        maxFontSizeMultiplier={1.2}
        style={{
          fontSize: size * 0.28,
          fontWeight: "700",
          color: colors.textPrimary,
          letterSpacing: -0.4,
        }}
      >
        oG
      </Text>
    </View>
  );
}

export function AuthShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.authBackdrop} pointerEvents="none">
        <Image
          source={authArtwork}
          style={styles.authArtwork}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        <View style={styles.authArtworkScrim} />
      </View>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.authContent,
          {
            paddingTop: insets.top + spacing.xxxl,
            paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.authBody}>{children}</View>
        {footer ? <View style={styles.authFooter}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Screen({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.screen, { paddingTop: insets.top + spacing.xl }, style]}
    >
      {children}
    </View>
  );
}

type FieldProps = TextInputProps & {
  label: string;
  error?: string | null;
  helperText?: string;
  inputRef?: Ref<TextInput>;
  trailing?: ReactNode;
};

export function Field({
  label,
  error,
  helperText,
  inputRef,
  trailing,
  style,
  onFocus,
  onBlur,
  ...inputProps
}: FieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputBox,
          focused && styles.inputBoxFocused,
          error ? styles.inputBoxError : null,
          inputProps.editable === false && styles.inputBoxDisabled,
        ]}
      >
        <TextInput
          ref={inputRef}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel={label}
          accessibilityState={{ disabled: inputProps.editable === false }}
          accessibilityHint={error ?? helperText}
          {...inputProps}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            inputProps.editable === false && styles.inputDisabled,
            style,
          ]}
        />
        {trailing}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.fieldError}>
          {error}
        </Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

function EyeIcon({
  visible,
  color,
  size = 19,
}: {
  visible: boolean;
  color: string;
  size?: number;
}) {
  return (
    <View style={{ width: size, height: size, alignItems: "center" }}>
      <View
        style={{
          position: "absolute",
          top: size * 0.24,
          width: size,
          height: size * 0.54,
          borderRadius: size,
          borderWidth: 1.5,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: size * 0.42,
          width: size * 0.24,
          height: size * 0.24,
          borderRadius: size,
          backgroundColor: color,
        }}
      />
      {visible ? null : (
        <View
          style={{
            position: "absolute",
            top: size * 0.46,
            width: size * 1.16,
            height: 1.5,
            backgroundColor: color,
            transform: [{ rotate: "-42deg" }],
          }}
        />
      )}
    </View>
  );
}

export function PasswordField({
  label,
  error,
  helperText,
  inputRef,
  ...inputProps
}: Omit<FieldProps, "secureTextEntry" | "trailing">) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <Field
      {...inputProps}
      inputRef={inputRef}
      label={label}
      error={error}
      helperText={helperText}
      secureTextEntry={!visible}
      trailing={
        <Pressable
          onPress={() => setVisible((current) => !current)}
          accessibilityRole="button"
          accessibilityLabel={
            visible ? t("Şifreyi gizle") : t("Şifreyi göster")
          }
          hitSlop={10}
          style={({ pressed }) => [
            styles.trailingButton,
            pressed && styles.pressed,
          ]}
        >
          <EyeIcon visible={visible} color={colors.textSecondary} />
        </Pressable>
      }
    />
  );
}

export type ButtonVariant = "primary" | "secondary" | "danger";

export function Button({
  title,
  onPress,
  busy = false,
  disabled = false,
  variant = "primary",
  ghost,
  icon,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  /** @deprecated Bunun yerine `variant="secondary"` kullanın. */
  ghost?: boolean;
  icon?: ReactNode;
}) {
  const resolvedVariant = ghost ? "secondary" : variant;
  const inactive = disabled || busy;
  const foreground =
    resolvedVariant === "primary"
      ? colors.onPrimary
      : resolvedVariant === "danger"
        ? colors.error
        : colors.textPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      accessibilityLabel={title}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        resolvedVariant === "secondary" && styles.buttonSecondary,
        resolvedVariant === "danger" && styles.buttonDanger,
        pressed && styles.buttonPressed,
        inactive && styles.disabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon}
          <Text style={[styles.buttonText, { color: foreground }]}>
            {title}
          </Text>
        </>
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
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.checkboxRow, pressed && styles.pressed]}
      onPress={onToggle}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

export function StatusMessage({
  text,
  tone = "error",
  actionLabel,
  onAction,
}: {
  text: string | null;
  tone?: "error" | "success" | "warning" | "neutral";
  actionLabel?: string;
  onAction?: () => void;
}) {
  if (!text) return null;

  const palette =
    tone === "success"
      ? { foreground: colors.success, background: colors.successSurface }
      : tone === "warning"
        ? { foreground: colors.warning, background: colors.warningSurface }
        : tone === "neutral"
          ? {
              foreground: colors.textSecondary,
              background: colors.surfaceRaised,
            }
          : { foreground: colors.error, background: colors.errorSurface };

  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : undefined}
      style={[styles.message, { backgroundColor: palette.background }]}
    >
      <Text style={[styles.messageText, { color: palette.foreground }]}>
        {text}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={[styles.messageAction, { color: palette.foreground }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ErrorMsg({ text }: { text: string | null }) {
  return <StatusMessage text={text} />;
}

export function InfoMsg({ text }: { text: string | null }) {
  return <StatusMessage text={text} tone="success" />;
}

export function Skeleton({
  width = "100%",
  height,
  radius: skeletonRadius = radius.small,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(0.46)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(0.56);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.82,
          duration: motion.slow * 3,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.46,
          duration: motion.slow * 3,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, reducedMotion]);

  return (
    <Animated.View
      accessibilityElementsHidden
      style={[
        styles.skeleton,
        { width, height, borderRadius: skeletonRadius, opacity },
        style,
      ]}
    />
  );
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xl,
  },
  authBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
  },
  authArtwork: {
    position: "absolute",
    top: -92,
    left: 0,
    right: 0,
    width: "100%",
    height: 430,
    opacity: 0.14,
  },
  authArtworkScrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(6,6,7,0.36)",
    experimental_backgroundImage:
      "linear-gradient(180deg, rgba(6,6,7,0.08) 0%, rgba(6,6,7,0.76) 38%, #060607 64%)",
  },
  authContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  authBody: { flexGrow: 1 },
  authFooter: { paddingTop: spacing.xl },
  heading: {
    ...type.screenTitle,
    color: colors.textPrimary,
    marginTop: spacing.xl,
  },
  sub: {
    ...type.supporting,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  spacer: { flex: 1 },
  footer: {
    ...type.supporting,
    textAlign: "center",
    color: colors.textSecondary,
  },
  footerStrong: { color: colors.textPrimary, fontWeight: "700" },
  link: {
    ...type.supporting,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.md,
    minHeight: 48,
    textAlignVertical: "center",
  },
  field: { gap: 7 },
  label: { ...type.label, color: colors.textSecondary },
  inputBox: {
    minHeight: 54,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceInput,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  inputBoxFocused: { borderColor: colors.textPrimary },
  inputBoxError: { borderColor: colors.error },
  inputBoxDisabled: { backgroundColor: colors.surface },
  input: {
    ...type.body,
    flex: 1,
    color: colors.textPrimary,
    paddingVertical: 12,
  },
  inputDisabled: { color: colors.textSecondary },
  trailingButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  helperText: { ...type.supporting, color: colors.textTertiary },
  fieldError: { ...type.supporting, color: colors.error },
  button: {
    minHeight: 54,
    borderRadius: radius.control,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  buttonSecondary: {
    backgroundColor: colors.surfaceRaised,
  },
  buttonDanger: { backgroundColor: colors.errorSurface },
  buttonPressed: { opacity: 0.78 },
  buttonText: { ...type.body, fontWeight: "700" },
  disabled: { opacity: 0.46 },
  pressed: { opacity: 0.68 },
  checkboxRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.outlineStrong,
    backgroundColor: colors.surfaceInput,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: { color: colors.onPrimary, fontWeight: "900", fontSize: 13 },
  checkboxLabel: {
    ...type.supporting,
    color: colors.textSecondary,
    flex: 1,
  },
  message: {
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  messageText: { ...type.supporting },
  messageAction: { ...type.label, minHeight: 32, textAlignVertical: "center" },
  skeleton: { backgroundColor: colors.surfaceRaised },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  tile: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.input,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  badge: {
    ...type.label,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
});
