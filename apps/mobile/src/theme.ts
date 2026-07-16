/**
 * OpenGym'in tek koyu görünümü. Bileşenler önce semantik rolleri kullanır;
 * aşağıdaki kısa takma adlar eski ekranlar aynı sözlüğe taşınırken uyumluluğu
 * korur.
 */
const palette = {
  black: "#060607",
  graphite: "#0d0d0f",
  graphiteRaised: "#151517",
  graphiteInput: "#101012",
  outline: "#252527",
  outlineStrong: "#38383c",
  white: "#f4f3f1",
  inkSecondary: "#a3a3a8",
  inkTertiary: "#7c7c82",
  inkDisabled: "#626268",
  green: "#83d46e",
  amber: "#d8b35f",
  red: "#ff6b5e",
} as const;

export const colors = {
  background: palette.black,
  surface: palette.graphite,
  surfaceRaised: palette.graphiteRaised,
  surfaceInput: palette.graphiteInput,
  outline: palette.outline,
  outlineStrong: palette.outlineStrong,

  textPrimary: palette.white,
  textSecondary: palette.inkSecondary,
  textTertiary: palette.inkTertiary,
  textDisabled: palette.inkDisabled,

  primary: palette.white,
  onPrimary: "#0b0b0c",
  primaryMuted: "rgba(244,243,241,0.10)",
  pressed: "rgba(244,243,241,0.08)",
  scrim: "rgba(0,0,0,0.62)",

  success: palette.green,
  successSurface: "rgba(131,212,110,0.12)",
  warning: palette.amber,
  warningSurface: "rgba(216,179,95,0.12)",
  error: palette.red,
  errorSurface: "rgba(255,107,94,0.12)",

  // Mevcut ekran kodu için uyumluluk takma adları.
  bg: palette.black,
  card: palette.graphite,
  tile: palette.graphiteRaised,
  input: palette.graphiteInput,
  border: palette.outline,
  borderStrong: palette.outlineStrong,
  ink: palette.white,
  inkDim: palette.inkSecondary,
  inkFaint: palette.inkTertiary,
  inkFainter: palette.inkDisabled,
  buttonBg: palette.white,
  buttonInk: "#0b0b0c",
  accent: palette.white,
  accentBg: "rgba(244,243,241,0.10)",
  ok: palette.green,
  okBg: "rgba(131,212,110,0.12)",
  danger: palette.red,
  dangerBg: "rgba(255,107,94,0.12)",
  streak: palette.amber,
  streakBg: "rgba(216,179,95,0.12)",
  neutralIconBg: "rgba(255,255,255,0.05)",
  gradientStart: "#303033",
  gradientEnd: "#171719",
  barStart: palette.white,
  barEnd: palette.inkTertiary,
} as const;

export const radius = {
  card: 16,
  control: 14,
  input: 12,
  small: 10,
  pill: 999,

  // Uyumluluk takma adları.
  lg: 16,
  md: 14,
  sm: 12,
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  gutter: 20,

  // Uyumluluk takma adları.
  pad: 20,
  padSm: 16,
  gap: 12,
} as const;

export const type = {
  screenTitle: { fontSize: 28, lineHeight: 34, fontWeight: "700" as const },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: "700" as const },
  title: { fontSize: 17, lineHeight: 23, fontWeight: "600" as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" as const },
  supporting: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "600" as const },
  metric: { fontSize: 44, lineHeight: 50, fontWeight: "700" as const },
} as const;

export const motion = {
  quick: 150,
  standard: 200,
  slow: 220,
} as const;

export const gradients = {
  squircle: `linear-gradient(135deg, ${colors.gradientStart}, ${colors.gradientEnd})`,
};
