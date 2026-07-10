import { Router } from "express";
import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import { z } from "zod";
import type {
  GymSettings,
  MyDeletionRequest,
  MySubscription,
  OccupancyResponse,
  QrTokenResponse,
} from "@opengym/shared";
import { db } from "../db.js";
import { redis } from "../redis.js";
import { requireRole } from "../middleware.js";
import { distanceMeters } from "../geo.js";
import { issueQrToken } from "../qr.js";
import {
  getSubscriptionSummary,
  hasActiveSubscription,
} from "../subscriptions.js";
import { isAnyDeviceOnline } from "../gateway.js";
import { getOccupancy } from "../occupancy.js";
import { logAudit } from "../audit.js";
import { isQrBlocked, recordSharingSignal, QR_LOC_KEY } from "../sharing.js";

export const meRouter: Router = Router();

// Oturumdaki kullanıcının güncel profili (rol/bayrak DB'den taze okunur)
meRouter.get(
  "/profile",
  requireRole("admin", "staff", "member"),
  (req, res) => {
    res.json(req.user);
  },
);

// US-4: üyenin kendi abonelik durumu (mobil ana ekran)
meRouter.get(
  "/subscription",
  requireRole("admin", "staff", "member"),
  async (req, res) => {
    const body: MySubscription = await getSubscriptionSummary(req.user!.id);
    res.json(body);
  },
);

const qrTokenSchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  /** Android: expo-location sahte konum (mock location) tespiti — Faz 6 */
  mocked: z.boolean().optional(),
});

// US-7: turnikede okutulacak kısa ömürlü, imzalı QR token üretimi
meRouter.post(
  "/qr-token",
  requireRole("admin", "staff", "member"),
  async (req, res) => {
    const parsed = qrTokenSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ message: "Geçersiz konum bilgisi." });
      return;
    }
    const { lat, lng, mocked } = parsed.data;

    // Basit hız sınırı: kullanıcı başına dakikada 30 QR isteği
    const rlKey = `og:rl:qr-token:${req.user!.id}`;
    const count = await redis.incr(rlKey);
    if (count === 1) {
      await redis.expire(rlKey, 60);
    }
    if (count > 30) {
      res
        .status(429)
        .json({ message: "Çok fazla istek. Lütfen biraz bekleyin." });
      return;
    }

    // Faz 6: eskalasyon eşiğini aşan hesaplarda QR üretimi geçici olarak kapalıdır
    if (await isQrBlocked(req.user!.id)) {
      res.status(403).json({
        code: "SHARING_BLOCKED",
        message:
          "Hesabınızda olağan dışı kullanım tespit edildi. QR üretimi geçici olarak kapatıldı. Lütfen resepsiyona başvurun.",
      });
      return;
    }

    if (!(await hasActiveSubscription(req.user!.id))) {
      res.status(403).json({
        code: "NO_ACTIVE_SUBSCRIPTION",
        message: "Aktif aboneliğiniz yok. Salon resepsiyonuna başvurun.",
      });
      return;
    }

    // Faz 6: iki farklı cihazdan kısa aralıkla, birbirinden uzak konumlarda QR
    // istekleri gelmesi hesap paylaşımı şüphesi olarak kaydedilir (istek
    // reddedilmez — yalnızca sinyal olarak işlenir)
    if (typeof lat === "number" && typeof lng === "number") {
      // Ham oturum token'ı hiçbir zaman sinyal/audit kaydına yazılmaz —
      // parmak izi header'ı yoksa (ör. iOS, web) token'ın SHA-256 hash'i
      // cihaz kimliği yerine geçer (geri döndürülemez, tek yönlü)
      const headerFp = req.header("x-device-fingerprint");
      const validHeaderFp =
        headerFp && /^[a-f0-9]{64}$/.test(headerFp) ? headerFp : null;
      const deviceId =
        validHeaderFp ??
        (req.sessionToken
          ? createHash("sha256").update(req.sessionToken).digest("hex")
          : null);
      const locKey = QR_LOC_KEY(req.user!.id);
      const prevRaw = await redis.get(locKey);
      if (prevRaw && deviceId) {
        const prev = JSON.parse(prevRaw) as {
          d: string | null;
          lat: number;
          lng: number;
          at: number;
        };
        if (prev.d && prev.d !== deviceId && Date.now() - prev.at < 120_000) {
          const distanceM = distanceMeters(prev.lat, prev.lng, lat, lng);
          if (distanceM > 1000) {
            await recordSharingSignal(req.user!, "location-inconsistency", {
              distanceM,
              deviceId,
              prevDeviceId: prev.d,
            });
          }
        }
      }
      await redis.set(
        locKey,
        JSON.stringify({ d: deviceId, lat, lng, at: Date.now() }),
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
        res.status(403).json({
          code: "LOCATION_REQUIRED",
          message:
            "Konum bilgisi alınamadı. Konum servisini açıp tekrar deneyin.",
        });
        return;
      }
      // Faz 6: expo-location "mocked" bayrağı true ise sahte konum uygulaması
      // tespit edilmiştir — QR üretimi reddedilir (giriş etkilenmez)
      if (mocked === true) {
        await recordSharingSignal(req.user!, "mock-location", { lat, lng });
        res.status(403).json({
          code: "MOCK_LOCATION",
          message:
            "Sahte konum tespit edildi. Konum taklit uygulamalarını kapatıp tekrar deneyin.",
        });
        return;
      }
      const distance = distanceMeters(lat, lng, location.lat, location.lng);
      if (distance > location.radiusM) {
        res.status(403).json({
          code: "OUT_OF_RANGE",
          message:
            "Salon konumunda görünmüyorsunuz. QR yalnızca salonda üretilebilir.",
        });
        return;
      }
    }

    const { token, expiresAt } = issueQrToken(req.user!.id);
    const body: QrTokenResponse = {
      token,
      expiresAt: expiresAt.toISOString(),
      gatewayOnline: isAnyDeviceOnline(),
    };
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
      res.status(403).json({
        message: "Yalnızca üye hesapları silme talebi oluşturabilir.",
      });
      return;
    }
    const userId = new ObjectId(req.user!.id);
    const existingPending = await db
      .collection("deletion_requests")
      .findOne({ userId, status: "pending" });
    if (existingPending) {
      res
        .status(409)
        .json({ message: "Zaten bekleyen bir silme talebiniz var." });
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
      res
        .status(404)
        .json({ message: "Bekleyen bir silme talebi bulunamadı." });
      return;
    }
    await logAudit(req.user!, "kvkk-deletion-cancelled");
    res.json({ ok: true });
  },
);
