import { Router } from "express";
import { ObjectId } from "mongodb";
import type { MySubscription } from "@opengym/shared";
import { db } from "../db.js";
import { requireRole } from "../middleware.js";

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
