import { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { MySubscription } from "@opengym/shared";
import { api } from "../lib/api";
import { authClient } from "../lib/auth";
import { colors } from "../theme";
import { Button, ErrorMsg } from "../ui";

export function Home({ userName }: { userName: string }) {
  const [sub, setSub] = useState<MySubscription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSub(await api<MySubscription>("/api/me/subscription"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={home.wrap}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.accent}
        />
      }
    >
      <Text style={home.hello}>Merhaba,</Text>
      <Text style={home.name}>{userName}</Text>

      <ErrorMsg text={error} />

      <View style={[home.card, sub?.active ? home.cardActive : home.cardInactive]}>
        <Text style={home.cardLabel}>ABONELİK</Text>
        {sub === null && !error ? (
          <Text style={home.big}>…</Text>
        ) : sub?.active ? (
          <>
            <Text style={home.big}>{sub.remainingDays}</Text>
            <Text style={home.unit}>gün kaldı</Text>
            <Text style={home.detail}>
              Bitiş: {new Date(sub.endsAt!).toLocaleDateString("tr-TR")}
            </Text>
          </>
        ) : (
          <>
            <Text style={[home.big, { color: colors.danger }]}>—</Text>
            <Text style={home.unit}>Aktif abonelik yok</Text>
            <Text style={home.detail}>
              Abonelik için salon resepsiyonuna başvurun.
            </Text>
          </>
        )}
      </View>

      <View style={home.card}>
        <Text style={home.cardLabel}>SALON DOLULUK</Text>
        <Text style={home.detail}>Faz 5'te eklenecek.</Text>
      </View>

      <Button title="Çıkış yap" ghost onPress={() => authClient.signOut()} />
    </ScrollView>
  );
}

const home = StyleSheet.create({
  wrap: {
    padding: 24,
    paddingTop: 70,
  },
  hello: {
    color: colors.inkDim,
    fontSize: 16,
  },
  name: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 24,
  },
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 20,
    marginBottom: 16,
  },
  cardActive: {
    borderTopWidth: 4,
    borderTopColor: colors.ok,
  },
  cardInactive: {
    borderTopWidth: 4,
    borderTopColor: colors.danger,
  },
  cardLabel: {
    color: colors.inkDim,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  big: {
    color: colors.ink,
    fontSize: 56,
    fontWeight: "900",
    lineHeight: 60,
  },
  unit: {
    color: colors.ink,
    fontSize: 16,
    marginBottom: 8,
  },
  detail: {
    color: colors.inkDim,
    fontSize: 13,
  },
});
