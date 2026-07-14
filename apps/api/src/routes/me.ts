import express, { Router } from "express";
import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import { z } from "zod";
import type {
  GateScanResponse,
  GymSettings,
  MyDeletionRequest,
  MySubscription,
  OccupancyResponse,
  ProfilePhotoResponse,
} from "@opengym/shared";
import { db } from "../db.js";
import { sendApiError } from "../apiError.js";
import { redis } from "../redis.js";
import { requireRole } from "../middleware.js";
import { distanceMeters } from "../geo.js";
import { verifyGateQr } from "../gateQr.js";
import {
  getSubscriptionSummary,
  hasActiveSubscription,
} from "../subscriptions.js";
import { openDevice } from "../gateway.js";
import { getOccupancy, markInside, markOutside } from "../occupancy.js";
import { enqueueEntryEvent } from "../eventQueue.js";
import { logAudit } from "../audit.js";
import { isQrBlocked, recordSharingSignal, QR_LOC_KEY } from "../sharing.js";
import {
  ProfilePhotoBusyError,
  ProfilePhotoConfigError,
  ProfilePhotoInputError,
  ProfilePhotoRateLimitError,
  removeUserProfilePhoto,
  storeUserProfilePhoto,
} from "../profilePhoto.js";

export const meRouter: Router = Router();

// Oturumdaki kullanıcının güncel profili (rol/bayrak DB'den taze okunur)
meRouter.get(
  "/profile",
  requireRole("admin", "staff", "member"),
  (req, res) => {
    res.json(req.user);
  },
);

// Üyenin kendi profil fotoğrafı: API görseli normalize edip R2'ye yazar.
meRouter.put(
  "/profile-photo",
  requireRole("member"),
  express.raw({ type: "*/*", limit: "10mb" }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body)) {
      sendApiError(
        res,
        400,
        "PROFILE_PHOTO_MISSING",
        "Fotoğraf verisi gönderilmedi.",
      );
      return;
    }
    try {
      const profilePhotoUrl = await storeUserProfilePhoto(
        req.user!.id,
        req.body,
        req.header("content-type") ?? "",
      );
      await logAudit(req.user!, "profile-photo-updated", req.user!.id);
      const body: ProfilePhotoResponse = { profilePhotoUrl };
      res.json(body);
    } catch (error) {
      if (error instanceof ProfilePhotoInputError) {
        sendApiError(res, 400, "PROFILE_PHOTO_INVALID", error.message);
        return;
      }
      if (error instanceof ProfilePhotoBusyError) {
        sendApiError(res, 409, "PROFILE_PHOTO_BUSY", error.message);
        return;
      }
      if (error instanceof ProfilePhotoRateLimitError) {
        sendApiError(res, 429, "PROFILE_PHOTO_RATE_LIMITED", error.message);
        return;
      }
      if (error instanceof ProfilePhotoConfigError) {
        sendApiError(res, 503, "PROFILE_PHOTO_UNAVAILABLE", error.message);
        return;
      }
      console.error("Profil fotoğrafı yüklenemedi", error);
      sendApiError(
        res,
        503,
        "PROFILE_PHOTO_UNAVAILABLE",
        "Profil fotoğrafı yüklenemedi. Lütfen tekrar deneyin.",
      );
    }
  },
);

meRouter.delete("/profile-photo", requireRole("member"), async (req, res) => {
  try {
    await removeUserProfilePhoto(req.user!.id);
    await logAudit(req.user!, "profile-photo-removed", req.user!.id);
    const body: ProfilePhotoResponse = { profilePhotoUrl: null };
    res.json(body);
  } catch (error) {
    if (error instanceof ProfilePhotoBusyError) {
      sendApiError(res, 409, "PROFILE_PHOTO_BUSY", error.message);
      return;
    }
    if (error instanceof ProfilePhotoConfigError) {
      sendApiError(res, 503, "PROFILE_PHOTO_UNAVAILABLE", error.message);
      return;
    }
    console.error("Profil fotoğrafı kaldırılamadı", error);
    sendApiError(
      res,
      503,
      "PROFILE_PHOTO_UNAVAILABLE",
      "Profil fotoğrafı kaldırılamadı. Lütfen tekrar deneyin.",
    );
  }
});

// US-4: üyenin kendi abonelik durumu (mobil ana ekran)
meRouter.get(
  "/subscription",
  requireRole("admin", "staff", "member"),
  async (req, res) => {
    const body: MySubscription = await getSubscriptionSummary(req.user!.id);
    res.json(body);
  },
);

const gateScanSchema = z.object({
  qr: z.string().min(1).max(200),
  lat: z.number().optional(),
  lng: z.number().optional(),
  /** Android: expo-location sahte konum (mock location) tespiti — Faz 6 */
  mocked: z.boolean().optional(),
});

// US-7: üyenin turnikeye yapıştırılmış statik QR'ı okutup geçiş talep etmesi
meRouter.post(
  "/gate-scan",
  requireRole("admin", "staff", "member"),
  async (req, res) => {
    const parsed = gateScanSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      sendApiError(res, 400, "INVALID_REQUEST", "Geçersiz istek.");
      return;
    }
    const { qr, lat, lng, mocked } = parsed.data;

    // Basit hız sınırı: kullanıcı başına dakikada 30 tarama isteği
    const rlKey = `og:rl:gate-scan:${req.user!.id}`;
    const count = await redis.incr(rlKey);
    if (count === 1) {
      await redis.expire(rlKey, 60);
    }
    if (count > 30) {
      sendApiError(
        res,
        429,
        "RATE_LIMITED",
        "Çok fazla istek. Lütfen biraz bekleyin.",
      );
      return;
    }

    const verified = verifyGateQr(qr);
    if (!verified.ok) {
      sendApiError(
        res,
        403,
        "INVALID_QR",
        "Geçersiz QR kodu. Turnikedeki kodu tekrar okutun.",
      );
      return;
    }
    const { deviceId } = verified;

    // Faz 6: eskalasyon eşiğini aşan hesaplarda geçiş geçici olarak kapalıdır
    if (await isQrBlocked(req.user!.id)) {
      sendApiError(
        res,
        403,
        "SHARING_BLOCKED",
        "Hesabınızda olağan dışı kullanım tespit edildi. Geçiş geçici olarak kapatıldı. Lütfen resepsiyona başvurun.",
      );
      return;
    }

    // Faz 6: expo-location "mocked" bayrağı true ise sahte konum uygulaması
    // tespit edilmiştir — geçiş reddedilir. Bu kontrol salon konumu
    // yapılandırılmamış olsa bile çalışır ve konum geçmişi (QR_LOC_KEY)
    // yazılmadan ÖNCE yapılır: sahte koordinatlar konum tutarsızlığı
    // sinyalini beslememeli
    if (mocked === true) {
      await recordSharingSignal(req.user!, "mock-location", { lat, lng });
      sendApiError(
        res,
        403,
        "MOCK_LOCATION",
        "Sahte konum tespit edildi. Konum taklit uygulamalarını kapatıp tekrar deneyin.",
      );
      return;
    }

    const device = await db
      .collection("devices")
      .findOne({ _id: new ObjectId(deviceId) });
    if (!device) {
      sendApiError(
        res,
        403,
        "UNKNOWN_DEVICE",
        "Bu turnike artık kayıtlı değil. Resepsiyona başvurun.",
      );
      return;
    }
    const deviceName = device.name as string;
    const direction = (device.direction as "in" | "out" | undefined) ?? "in";

    // Çıkışta abonelik aranmaz — süresi bitmiş üye de dışarı çıkabilmeli
    if (direction === "in" && !(await hasActiveSubscription(req.user!.id))) {
      enqueueEntryEvent({
        deviceId,
        deviceName,
        userId: req.user!.id,
        memberName: req.user!.name,
        allowed: false,
        reason: "NO_ACTIVE_SUBSCRIPTION",
        at: new Date(),
      });
      sendApiError(
        res,
        403,
        "NO_ACTIVE_SUBSCRIPTION",
        "Aktif aboneliğiniz yok. Salon resepsiyonuna başvurun.",
      );
      return;
    }

    // Faz 6: iki farklı cihazdan kısa aralıkla, birbirinden uzak konumlarda
    // tarama istekleri gelmesi hesap paylaşımı şüphesi olarak kaydedilir
    // (istek reddedilmez — yalnızca sinyal olarak işlenir)
    if (typeof lat === "number" && typeof lng === "number") {
      // Ham oturum token'ı hiçbir zaman sinyal/audit kaydına yazılmaz —
      // parmak izi header'ı yoksa (ör. iOS, web) token'ın SHA-256 hash'i
      // cihaz kimliği yerine geçer (geri döndürülemez, tek yönlü)
      const headerFp = req.header("x-device-fingerprint");
      const validHeaderFp =
        headerFp && /^[a-f0-9]{64}$/.test(headerFp) ? headerFp : null;
      const fingerprintId =
        validHeaderFp ??
        (req.sessionToken
          ? createHash("sha256").update(req.sessionToken).digest("hex")
          : null);
      const locKey = QR_LOC_KEY(req.user!.id);
      const prevRaw = await redis.get(locKey);
      if (prevRaw && fingerprintId) {
        const prev = JSON.parse(prevRaw) as {
          d: string | null;
          lat: number;
          lng: number;
          at: number;
        };
        if (
          prev.d &&
          prev.d !== fingerprintId &&
          Date.now() - prev.at < 120_000
        ) {
          const distanceM = distanceMeters(prev.lat, prev.lng, lat, lng);
          if (distanceM > 1000) {
            await recordSharingSignal(req.user!, "location-inconsistency", {
              distanceM,
              deviceId: fingerprintId,
              prevDeviceId: prev.d,
            });
          }
        }
      }
      await redis.set(
        locKey,
        JSON.stringify({ d: fingerprintId, lat, lng, at: Date.now() }),
        { EX: 120 },
      );
    }

    const settings = await db
      .collection("settings")
      .findOne({ _id: "gym" as never });
    const location = (settings as { location?: GymSettings["location"] } | null)
      ?.location;
    // Operatör konum doğrulamayı yapılandırmamışsa mesafe kontrolü atlanır
    if (location) {
      if (typeof lat !== "number" || typeof lng !== "number") {
        enqueueEntryEvent({
          deviceId,
          deviceName,
          userId: req.user!.id,
          memberName: req.user!.name,
          allowed: false,
          reason: "LOCATION_REQUIRED",
          at: new Date(),
        });
        sendApiError(
          res,
          403,
          "LOCATION_REQUIRED",
          "Konum bilgisi alınamadı. Konum servisini açıp tekrar deneyin.",
        );
        return;
      }
      const distance = distanceMeters(lat, lng, location.lat, location.lng);
      if (distance > location.radiusM) {
        enqueueEntryEvent({
          deviceId,
          deviceName,
          userId: req.user!.id,
          memberName: req.user!.name,
          allowed: false,
          reason: "OUT_OF_RANGE",
          at: new Date(),
        });
        sendApiError(
          res,
          403,
          "OUT_OF_RANGE",
          "Salon konumunda görünmüyorsunuz. Geçiş yalnızca salonda yapılabilir.",
        );
        return;
      }
    }

    // Kısa süreli çift tarama kilidi: aynı üye+cihaz için ard arda taramalar
    const lockKey = `og:gate-open:${req.user!.id}:${deviceId}`;
    const acquired = await redis.set(lockKey, "1", { NX: true, EX: 3 });
    if (acquired === null) {
      sendApiError(
        res,
        429,
        "RATE_LIMITED",
        "Çok fazla istek. Lütfen biraz bekleyin.",
      );
      return;
    }

    const openMs = 500;
    if (!openDevice(deviceId, openMs)) {
      enqueueEntryEvent({
        deviceId,
        deviceName,
        userId: req.user!.id,
        memberName: req.user!.name,
        allowed: false,
        reason: "DEVICE_OFFLINE",
        at: new Date(),
      });
      sendApiError(
        res,
        403,
        "DEVICE_OFFLINE",
        "Turnike bağlantısı yok. Lütfen resepsiyona başvurun.",
      );
      return;
    }

    if (direction === "out") {
      await markOutside(req.user!.id);
    } else {
      await markInside(req.user!.id);
    }
    enqueueEntryEvent({
      deviceId,
      deviceName,
      userId: req.user!.id,
      memberName: req.user!.name,
      allowed: true,
      reason: null,
      at: new Date(),
    });

    const body: GateScanResponse = { ok: true, deviceName, direction, openMs };
    res.json(body);
  },
);

// Faz 5 — US-4: anlık salon doluluğu
meRouter.get(
  "/occupancy",
  requireRole("admin", "staff", "member"),
  async (_req, res) => {
    const inside = await getOccupancy();
    const settings = await db
      .collection("settings")
      .findOne({ _id: "gym" as never });
    const capacity = (settings?.capacity as number | null | undefined) ?? null;
    const body: OccupancyResponse = {
      inside,
      capacity,
      ratio: capacity ? Math.round((inside / capacity) * 100) / 100 : null,
    };
    res.json(body);
  },
);

// Faz 5 — KVKK: üyenin kendi hesap silme talebi durumu
meRouter.get(
  "/deletion-request",
  requireRole("admin", "staff", "member"),
  async (req, res) => {
    const latest = await db
      .collection("deletion_requests")
      .find({ userId: new ObjectId(req.user!.id) })
      .sort({ requestedAt: -1 })
      .limit(1)
      .next();
    const body: MyDeletionRequest = latest
      ? {
          status:
            latest.status === "pending"
              ? "pending"
              : latest.status === "rejected"
                ? "rejected"
                : "none",
          requestedAt: latest.requestedAt
            ? new Date(latest.requestedAt).toISOString()
            : null,
        }
      : { status: "none", requestedAt: null };
    res.json(body);
  },
);

// KVKK: hesap silme talebi oluşturma — yalnızca üye rolü kendi hesabı için talep açabilir
meRouter.post(
  "/deletion-request",
  requireRole("admin", "staff", "member"),
  async (req, res) => {
    if (req.user!.role !== "member") {
      sendApiError(
        res,
        403,
        "DELETION_MEMBER_ONLY",
        "Yalnızca üye hesapları silme talebi oluşturabilir.",
      );
      return;
    }
    const userId = new ObjectId(req.user!.id);
    const existingPending = await db
      .collection("deletion_requests")
      .findOne({ userId, status: "pending" });
    if (existingPending) {
      sendApiError(
        res,
        409,
        "DELETION_ALREADY_PENDING",
        "Zaten bekleyen bir silme talebiniz var.",
      );
      return;
    }
    await db.collection("deletion_requests").insertOne({
      userId,
      email: req.user!.email,
      name: req.user!.name,
      requestedAt: new Date(),
      status: "pending",
      resolvedAt: null,
      resolvedBy: null,
    });
    await logAudit(req.user!, "kvkk-deletion-requested");
    res.json({ ok: true });
  },
);

// KVKK: bekleyen silme talebini geri çekme
meRouter.delete(
  "/deletion-request",
  requireRole("admin", "staff", "member"),
  async (req, res) => {
    const result = await db.collection("deletion_requests").deleteOne({
      userId: new ObjectId(req.user!.id),
      status: "pending",
    });
    if (result.deletedCount === 0) {
      sendApiError(
        res,
        404,
        "DELETION_NOT_PENDING",
        "Bekleyen bir silme talebi bulunamadı.",
      );
      return;
    }
    await logAudit(req.user!, "kvkk-deletion-cancelled");
    res.json({ ok: true });
  },
);
