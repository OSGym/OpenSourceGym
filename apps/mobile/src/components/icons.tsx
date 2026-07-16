import { View, type ViewStyle } from "react-native";

// Small presentational glyphs built from plain Views (no react-native-svg
// dependency in this workspace — adding one would require a native
// dev-client rebuild that can't be verified in this environment). Shapes
// approximate the SVG icons from the design mockup closely enough for the
// dark/rounded visual language without needing exact path fidelity.

/** Approximates the design's bottom-nav QR/scan icon (three finder squares
 * + a small module cluster) for the Home screen's QR entry button. */
export function QrGlyph({
  size = 20,
  color,
}: {
  size?: number;
  color: string;
}) {
  const u = size / 24;
  const square: ViewStyle = {
    position: "absolute",
    width: 7 * u,
    height: 7 * u,
    borderRadius: 1.4 * u,
    borderWidth: 1.8 * u,
    borderColor: color,
  };
  return (
    <View style={{ width: size, height: size }}>
      <View style={[square, { left: 3 * u, top: 3 * u }]} />
      <View style={[square, { left: 14 * u, top: 3 * u }]} />
      <View style={[square, { left: 3 * u, top: 14 * u }]} />
      <View
        style={[
          square,
          {
            left: 14 * u,
            top: 14 * u,
            width: 3.4 * u,
            height: 3.4 * u,
            borderRadius: 1 * u,
          },
        ]}
      />
      <View
        style={{
          position: "absolute",
          left: 19.6 * u,
          top: 14 * u,
          width: 1.6 * u,
          height: 6.6 * u,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 14 * u,
          top: 19.6 * u,
          width: 6.6 * u,
          height: 1.6 * u,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Rounded card with a header divider — stands in for the design's calendar
 * icon on the "Üyelik durumu" card. */
export function CalendarGlyph({
  size = 19,
  color,
}: {
  size?: number;
  color: string;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        borderWidth: 1.6,
        borderColor: color,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          height: size * 0.32,
          borderBottomWidth: 1.6,
          borderBottomColor: color,
        }}
      />
    </View>
  );
}

/** Envelope silhouette (rect + a "V" flap) for the e-mail OTP badge —
 * adapted from the design's phone-verification icon since this app verifies
 * by e-mail, not SMS. */
export function EnvelopeGlyph({
  size = 24,
  color,
}: {
  size?: number;
  color: string;
}) {
  const height = size * 0.72;
  return (
    <View style={{ width: size, height, alignItems: "center" }}>
      <View
        style={{
          position: "absolute",
          width: size,
          height,
          borderRadius: 4,
          borderWidth: 1.6,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: height * 0.12,
          left: size * 0.08,
          width: size * 0.46,
          height: 1.6,
          backgroundColor: color,
          transform: [{ rotate: "26deg" }],
        }}
      />
      <View
        style={{
          position: "absolute",
          top: height * 0.12,
          right: size * 0.08,
          width: size * 0.46,
          height: 1.6,
          backgroundColor: color,
          transform: [{ rotate: "-26deg" }],
        }}
      />
    </View>
  );
}

/** Bell silhouette for the dashboard header's notification button. */
export function BellGlyph({
  size = 18,
  color,
}: {
  size?: number;
  color: string;
}) {
  const u = size / 24;
  return (
    <View style={{ width: size, height: size, alignItems: "center" }}>
      <View
        style={{
          position: "absolute",
          top: 2 * u,
          width: 14 * u,
          height: 12 * u,
          borderTopLeftRadius: 7 * u,
          borderTopRightRadius: 7 * u,
          borderWidth: 1.8 * u,
          borderBottomWidth: 0,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 13.5 * u,
          width: 18 * u,
          height: 1.8 * u,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 16 * u,
          width: 6 * u,
          height: 3 * u,
          borderBottomLeftRadius: 3 * u,
          borderBottomRightRadius: 3 * u,
          borderWidth: 1.8 * u,
          borderTopWidth: 0,
          borderColor: color,
        }}
      />
    </View>
  );
}

/** Flame silhouette for the daily-streak stat card. */
export function FlameGlyph({
  size = 20,
  color,
}: {
  size?: number;
  color: string;
}) {
  const u = size / 24;
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "flex-end",
      }}
    >
      <View
        style={{
          width: 13 * u,
          height: 16 * u,
          borderRadius: 7 * u,
          backgroundColor: color,
          transform: [{ rotate: "180deg" }],
        }}
      />
    </View>
  );
}

/** Barbell silhouette (bar + a weight disc on each end) for the body-weight
 * stat card. */
export function BarbellGlyph({
  size = 20,
  color,
}: {
  size?: number;
  color: string;
}) {
  const u = size / 24;
  const disc: ViewStyle = {
    position: "absolute",
    width: 4 * u,
    height: 8 * u,
    borderRadius: 2 * u,
    borderWidth: 1.8 * u,
    borderColor: color,
    top: 8 * u,
  };
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: "absolute",
          left: 6 * u,
          top: 11 * u,
          width: 12 * u,
          height: 1.8 * u,
          backgroundColor: color,
        }}
      />
      <View style={[disc, { left: 2 * u }]} />
      <View style={[disc, { left: 18 * u }]} />
    </View>
  );
}

/** Clock face for the "gym open now" info row. */
export function ClockGlyph({
  size = 19,
  color,
}: {
  size?: number;
  color: string;
}) {
  const u = size / 24;
  return (
    <View
      style={{
        width: 18 * u,
        height: 18 * u,
        borderRadius: 9 * u,
        borderWidth: 1.8 * u,
        borderColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          width: 1.6 * u,
          height: 5 * u,
          backgroundColor: color,
          top: 3.5 * u,
          borderRadius: 1,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: 4 * u,
          height: 1.6 * u,
          backgroundColor: color,
          left: 9 * u,
          top: 8.5 * u,
          borderRadius: 1,
          transform: [{ rotate: "35deg" }],
        }}
      />
    </View>
  );
}

/** Simple right-pointing chevron for disclosure rows. */
export function ChevronRightGlyph({
  size = 16,
  color,
}: {
  size?: number;
  color: string;
}) {
  const u = size / 24;
  return (
    <View
      style={{
        width: 8 * u,
        height: 8 * u,
        borderTopWidth: 2 * u,
        borderRightWidth: 2 * u,
        borderColor: color,
        transform: [{ rotate: "45deg" }],
      }}
    />
  );
}

/** Speech-bubble silhouette for the group-class reminder card. */
export function ChatGlyph({
  size = 19,
  color,
}: {
  size?: number;
  color: string;
}) {
  const u = size / 24;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: "absolute",
          left: 2 * u,
          top: 2 * u,
          width: 20 * u,
          height: 14 * u,
          borderRadius: 3 * u,
          borderWidth: 1.8 * u,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 4 * u,
          top: 14.5 * u,
          width: 0,
          height: 0,
          borderTopWidth: 4 * u,
          borderRightWidth: 4 * u,
          borderTopColor: color,
          borderRightColor: "transparent",
        }}
      />
    </View>
  );
}

/** Two uneven bars — the mockup's "Dashboard" tab-bar glyph. */
export function DashboardGlyph({
  size = 22,
  color,
}: {
  size?: number;
  color: string;
}) {
  const u = size / 24;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: "absolute",
          left: 3 * u,
          top: 10 * u,
          width: 7 * u,
          height: 10 * u,
          borderRadius: 1.5 * u,
          borderWidth: 1.8 * u,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 14 * u,
          top: 4 * u,
          width: 7 * u,
          height: 16 * u,
          borderRadius: 1.5 * u,
          borderWidth: 1.8 * u,
          borderColor: color,
        }}
      />
    </View>
  );
}

/** Three uneven vertical bars — the mockup's "activity" tab-bar glyph. */
export function ActivityGlyph({
  size = 22,
  color,
}: {
  size?: number;
  color: string;
}) {
  const u = size / 24;
  const bar = (left: number, top: number, height: number): ViewStyle => ({
    position: "absolute",
    left: left * u,
    top: top * u,
    width: 1.8 * u,
    height: height * u,
    backgroundColor: color,
    borderRadius: 1,
  });
  return (
    <View style={{ width: size, height: size }}>
      <View style={bar(4, 10, 10)} />
      <View style={bar(12, 4, 16)} />
      <View style={bar(20, 13, 7)} />
    </View>
  );
}

/** Head-and-shoulders silhouette — the mockup's "profile" tab-bar glyph. */
export function PersonGlyph({
  size = 22,
  color,
}: {
  size?: number;
  color: string;
}) {
  const u = size / 24;
  return (
    <View style={{ width: size, height: size, alignItems: "center" }}>
      <View
        style={{
          position: "absolute",
          top: 4 * u,
          width: 8 * u,
          height: 8 * u,
          borderRadius: 4 * u,
          borderWidth: 1.8 * u,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 14 * u,
          width: 16 * u,
          height: 8 * u,
          borderTopLeftRadius: 8 * u,
          borderTopRightRadius: 8 * u,
          borderWidth: 1.8 * u,
          borderBottomWidth: 0,
          borderColor: color,
        }}
      />
    </View>
  );
}
