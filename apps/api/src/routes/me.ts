import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import type {
  GymSettings,
  MySubscription,
  QrTokenResponse,
} from "@opengym/shared";
import { db } from "../db.js";
import { redis } from "../redis.js";
import { requireRole } from "../middleware.js";
import { distanceMeters } from "../geo.js";
import { issueQrToken } from "../qr.js";
import { hasActiveSubscription } from "../subscriptions.js";
import { isAnyDeviceOnline } from "../gateway.js";

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
