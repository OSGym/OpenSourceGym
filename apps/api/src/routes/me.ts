import { Router } from "express";
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
import { hasActiveSubscription } from "../subscriptions.js";
import { isAnyDeviceOnline } from "../gateway.js";
import { getOccupancy } from "../occupancy.js";
import { logAudit } from "../audit.js";

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
    const now = new Date();
    const active = await db
      .collection("subscriptions")
      .find({ userId: new ObjectId(req.user!.id), endsAt: { $gte: now } })
      .sort({ endsAt: -1 })
      .limit(1)
      .next();
    const body: MySubscription = active
      ? {
          active: active.startsAt <= now,
          endsAt: active.endsAt.toISOString(),
          remainingDays: Math.max(
            0,
            Math.ceil((active.endsAt.getTime() - now.getTime()) / 86_400_000),
          ),
        }
      : { active: false, endsAt: null, remainingDays: 0 };
    res.json(body);
  },
);

const qrTokenSchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
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
    const { lat, lng } = parsed.data;

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

    if (!(await hasActiveSubscription(req.user!.id))) {
      res.status(403).json({
        code: "NO_ACTIVE_SUBSCRIPTION",
        message: "Aktif aboneliğiniz yok. Salon resepsiyonuna başvurun.",
      });
      return;
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
      res.status(409).json({ message: "Zaten bekleyen bir silme talebiniz var." });
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
      res.status(404).json({ message: "Bekleyen bir silme talebi bulunamadı." });
      return;
    }
    await logAudit(req.user!, "kvkk-deletion-cancelled");
    res.json({ ok: true });
  },
);
