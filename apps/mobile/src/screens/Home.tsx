import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type {
  MyProfile,
  MyDeletionRequest,
  MySubscription,
  OccupancyResponse,
  ProfilePhotoResponse,
} from "@opengym/shared";
import { ApiError, api, uploadBinary } from "../lib/api";
import { authClient } from "../lib/auth";
import { colors } from "../theme";
import { Button, ErrorMsg } from "../ui";

export function Home({
  userName,
  onOpenQr,
}: {
  userName: string;
  onOpenQr: () => void;
}) {
  const [sub, setSub] = useState<MySubscription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [profileName, setProfileName] = useState(userName);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);

  const [occupancy, setOccupancy] = useState<OccupancyResponse | null>(null);
  const [occupancyLoaded, setOccupancyLoaded] = useState(false);

  const [deletion, setDeletion] = useState<MyDeletionRequest | null>(null);
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const [deletionBusy, setDeletionBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const profile = await api<MyProfile>("/api/me/profile");
      setProfileName(profile.name);
      setProfilePhotoUrl(profile.profilePhotoUrl);
      setPhotoLoadFailed(false);
    } catch {
      // Profil fotoğrafı yüklenemese de abonelik ekranı çalışmaya devam eder.
    }
    try {
      setSub(await api<MySubscription>("/api/me/subscription"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    }

    try {
      setOccupancy(await api<OccupancyResponse>("/api/me/occupancy"));
    } catch {
      // Sessiz düş — doluluk kartı "—" gösterir, ekranı bozmaz.
      setOccupancy(null);
    } finally {
      setOccupancyLoaded(true);
    }

    try {
      setDeletion(await api<MyDeletionRequest>("/api/me/deletion-request"));
    } catch {
      // Sessiz düş — silme talebi bölümü varsayılan (talep yok) durumda kalır.
    }
  }, []);

  async function chooseProfilePhoto() {
    setPhotoError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotoError("Fotoğraf seçmek için galeri izni vermelisiniz.");
      return;
    }

    const selected = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
      allowsMultipleSelection: false,
    });
    if (selected.canceled || !selected.assets[0]) return;

    setPhotoBusy(true);
    try {
      // Native modülü yalnızca fotoğraf işlenirken yükle. Böylece modülü henüz
      // içermeyen eski development client'lar uygulama açılışında çökmez.
      const { ImageManipulator, SaveFormat } = await import(
        "expo-image-manipulator"
      );
      const context = ImageManipulator.manipulate(selected.assets[0].uri);
      // Tek boyut ver: iki boyut vermek görseli 1024×1024'e esnetir (stretch);
      // kare kırpma sunucudaki fit: "cover" normalizasyonuna bırakılır.
      context.resize({ width: 1024 });
      const rendered = await context.renderAsync();
      const normalized = await rendered.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.88,
      });
      const response = await uploadBinary<ProfilePhotoResponse>(
        "/api/me/profile-photo",
        normalized.uri,
        "image/jpeg",
      );
      setProfilePhotoUrl(response.profilePhotoUrl);
      setPhotoLoadFailed(false);
    } catch (err) {
      setPhotoError(
        err instanceof Error
          ? err.message
          : "Profil fotoğrafı yüklenemedi. Tekrar deneyin.",
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  function confirmRemoveProfilePhoto() {
    Alert.alert("Fotoğrafı kaldır", "Profil fotoğrafınız kaldırılsın mı?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Kaldır",
        style: "destructive",
        onPress: () => void removeProfilePhoto(),
      },
    ]);
  }

  async function removeProfilePhoto() {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      await api<ProfilePhotoResponse>("/api/me/profile-photo", {
        method: "DELETE",
      });
      setProfilePhotoUrl(null);
      setPhotoLoadFailed(false);
    } catch (err) {
      setPhotoError(
        err instanceof Error
          ? err.message
          : "Profil fotoğrafı kaldırılamadı. Tekrar deneyin.",
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function confirmDeletion() {
    Alert.alert(
      "Hesabı sil",
      "Bu talep personel onayına gönderilir. Onaylanırsa hesabınız ve kişisel verileriniz kalıcı olarak silinir, bu işlem geri alınamaz.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Talep oluştur",
          style: "destructive",
          onPress: () => void requestDeletion(),
        },
      ],
    );
  }

  async function requestDeletion() {
    setDeletionError(null);
    setDeletionBusy(true);
    try {
      await api("/api/me/deletion-request", { method: "POST" });
      setDeletion(await api<MyDeletionRequest>("/api/me/deletion-request"));
    } catch (err) {
      setDeletionError(
        err instanceof ApiError
          ? err.message
          : "Talep oluşturulamadı. Tekrar deneyin.",
      );
    } finally {
      setDeletionBusy(false);
    }
  }

  async function cancelDeletion() {
    setDeletionError(null);
    setDeletionBusy(true);
    try {
      await api("/api/me/deletion-request", { method: "DELETE" });
      setDeletion(await api<MyDeletionRequest>("/api/me/deletion-request"));
    } catch (err) {
      setDeletionError(
        err instanceof ApiError
          ? err.message
          : "Talep iptal edilemedi. Tekrar deneyin.",
      );
    } finally {
      setDeletionBusy(false);
    }
  }

  const occupancyPercent =
    occupancy?.ratio != null ? Math.round(occupancy.ratio * 100) : null;
  const occupancyColor =
    occupancyPercent == null
      ? colors.ink
      : occupancyPercent > 90
        ? colors.danger
        : occupancyPercent >= 70
          ? colors.accent
          : colors.ok;
  const initials = profileName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr-TR") ?? "")
    .join("");

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
      <View style={home.profileHeader}>
        <View style={home.avatarFrame}>
          {profilePhotoUrl && !photoLoadFailed ? (
            <Image
              source={{ uri: profilePhotoUrl }}
              style={home.avatarImage}
              accessibilityLabel={`${profileName} profil fotoğrafı`}
              onError={() => setPhotoLoadFailed(true)}
            />
          ) : (
            <Text style={home.avatarInitials}>{initials || "Ü"}</Text>
          )}
        </View>
        <View style={home.profileCopy}>
          <Text style={home.hello}>Merhaba,</Text>
          <Text style={home.name}>{profileName}</Text>
          <View style={home.photoActions}>
            <Pressable
              onPress={() => void chooseProfilePhoto()}
              disabled={photoBusy}
              hitSlop={8}
            >
              <Text style={[home.photoAction, photoBusy && home.disabled]}>
                {photoBusy
                  ? "İşleniyor…"
                  : profilePhotoUrl
                    ? "Fotoğrafı değiştir"
                    : "Fotoğraf ekle"}
              </Text>
            </Pressable>
            {profilePhotoUrl && (
              <Pressable
                onPress={confirmRemoveProfilePhoto}
                disabled={photoBusy}
                hitSlop={8}
              >
                <Text style={[home.photoRemove, photoBusy && home.disabled]}>
                  Kaldır
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      <ErrorMsg text={photoError} />

      <ErrorMsg text={error} />

      <View
        style={[home.card, sub?.active ? home.cardActive : home.cardInactive]}
      >
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

      <Button title="QR ile giriş" onPress={onOpenQr} />

      <View style={home.card}>
        <Text style={home.cardLabel}>SALON DOLULUK</Text>
        {!occupancyLoaded ? (
          <Text style={home.detail}>…</Text>
        ) : occupancy ? (
          <>
            <Text style={home.occupancyLine}>
              İçeride {occupancy.inside} kişi
            </Text>
            {occupancyPercent != null && (
              <Text style={[home.occupancyPercent, { color: occupancyColor }]}>
                %{occupancyPercent} doluluk
              </Text>
            )}
          </>
        ) : (
          <Text style={home.detail}>—</Text>
        )}
      </View>

      <Button title="Çıkış yap" ghost onPress={() => authClient.signOut()} />

      <View style={home.deletionZone}>
        <ErrorMsg text={deletionError} />

        {deletion?.status === "pending" ? (
          <View style={home.pendingBanner}>
            <Text style={home.pendingBannerText}>
              Hesap silme talebiniz personel onayı bekliyor.
            </Text>
            <Pressable
              onPress={() => void cancelDeletion()}
              disabled={deletionBusy}
              hitSlop={8}
            >
              <Text
                style={[
                  home.pendingBannerAction,
                  deletionBusy && { opacity: 0.5 },
                ]}
              >
                {deletionBusy ? "İşleniyor…" : "Talebi iptal et"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {deletion?.status === "rejected" && (
              <Text style={home.mutedNote}>
                Önceki silme talebiniz reddedildi.
              </Text>
            )}
            <Pressable
              onPress={confirmDeletion}
              disabled={deletionBusy}
              hitSlop={8}
              style={{ alignSelf: "center" }}
            >
              <Text
                style={[
                  home.deleteAccountLink,
                  deletionBusy && { opacity: 0.5 },
                ]}
              >
                {deletionBusy ? "İşleniyor…" : "Hesabımı sil"}
              </Text>
            </Pressable>
          </>
        )}
      </View>
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
    marginBottom: 6,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  profileCopy: {
    flex: 1,
  },
  avatarFrame: {
    width: 84,
    height: 84,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.bgRaise,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitials: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 1,
  },
  photoActions: {
    flexDirection: "row",
    gap: 14,
  },
  photoAction: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  photoRemove: {
    color: colors.inkDim,
    fontSize: 12,
    textDecorationLine: "underline",
  },
  disabled: {
    opacity: 0.5,
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
  occupancyLine: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  occupancyPercent: {
    fontSize: 13,
    fontWeight: "700",
  },
  deletionZone: {
    marginTop: 28,
  },
  mutedNote: {
    color: colors.inkDim,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 8,
  },
  deleteAccountLink: {
    color: colors.danger,
    fontSize: 13,
    textDecorationLine: "underline",
  },
  pendingBanner: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.lineHard,
    padding: 14,
    alignItems: "center",
    gap: 8,
  },
  pendingBannerText: {
    color: colors.inkDim,
    fontSize: 13,
    textAlign: "center",
  },
  pendingBannerAction: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
