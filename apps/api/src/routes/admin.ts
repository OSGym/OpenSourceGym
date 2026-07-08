import { Router } from "express";
import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import type {
  EntryEvent,
  GymSettings,
  PublicUser,
  Role,
} from "@opengym/shared";
import { auth } from "../auth.js";
import { db } from "../db.js";
import { logAudit } from "../audit.js";
import { requireRole } from "../middleware.js";

export const adminRouter: Router = Router();

function toPublicUser(doc: {
  _id: ObjectId;
  name?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
  emailVerified?: boolean;
  createdAt?: Date;
}): PublicUser {
  return {
    id: doc._id.toString(),
    name: doc.name ?? "",
    email: doc.email ?? "",
    firstName: doc.firstName ?? "",
    lastName: doc.lastName ?? "",
    phone: doc.phone ?? "",
    role: (doc.role ?? "member") as Role,
    emailVerified: doc.emailVerified ?? false,
    createdAt: doc.createdAt?.toISOString() ?? "",
  };
}

function parseObjectId(value: string): ObjectId | null {
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

// US-2: ilk giriş sonrası zorunlu şifre değişimi
adminRouter.post(
  "/initial-password",
  requireRole("admin", "staff", "member"),
  async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      newPassword.length < 8
    ) {
      res
        .status(400)
        .json({ message: "Yeni şifre en az 8 karakter olmalıdır." });
      return;
    }
    try {
      await auth.api.changePassword({
        headers: fromNodeHeaders(req.headers),
        body: { currentPassword, newPassword, revokeOtherSessions: false },
      });
    } catch {
      res.status(400).json({ message: "Mevcut şifre hatalı." });
      return;
    }
    await db
      .collection("user")
      .updateOne(
        { _id: new ObjectId(req.user!.id) },
        { $set: { mustChangePassword: false } },
      );
    await logAudit(req.user!, "initial-password-changed");
    res.json({ ok: true });
  },
);

// US-3: telefon numarasıyla üye arama (personel + admin)
adminRouter.get("/users", requireRole("admin", "staff"), async (req, res) => {
  const phone = String(req.query.phone ?? "").trim();
  if (phone.length < 4) {
    res.status(400).json({ message: "En az 4 haneli telefon numarası girin." });
    return;
  }
  const escaped = phone.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const docs = await db
    .collection("user")
    .find({ phone: { $regex: escaped } })
    .limit(20)
    .toArray();
  res.json(docs.map((d) => toPublicUser(d as never)));
});

// US-3: rol atama (yalnızca admin) — MFA doğrulaması Faz 5'te eklenecek
adminRouter.post("/users/:id/role", requireRole("admin"), async (req, res) => {
  const idParam = String(req.params.id ?? "");
  const targetId = parseObjectId(idParam);
  const role = req.body?.role as Role | undefined;
  if (!targetId || !role || !["admin", "staff", "member"].includes(role)) {
    res.status(400).json({ message: "Geçersiz kullanıcı veya rol." });
    return;
  }
  if (idParam === req.user!.id) {
    res.status(400).json({ message: "Kendi rolünüzü değiştiremezsiniz." });
    return;
  }
  const result = await db
    .collection("user")
    .findOneAndUpdate({ _id: targetId }, { $set: { role } });
  if (!result) {
    res.status(404).json({ message: "Kullanıcı bulunamadı." });
    return;
  }
  await logAudit(req.user!, "role-assigned", idParam, {
    previousRole: result.role ?? "member",
    newRole: role,
  });
  res.json({ ok: true });
});

// US-6: abonelik tanımlama/uzatma (personel + admin)
adminRouter.post(
  "/subscriptions",
  requireRole("admin", "staff"),
  async (req, res) => {
    const { userId, startsAt, endsAt, note } = req.body ?? {};
    const targetId = typeof userId === "string" ? parseObjectId(userId) : null;
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (
      !targetId ||
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      res.status(400).json({
        message:
          "Geçerli kullanıcı ve tarih aralığı (bitiş > başlangıç) girin.",
      });
      return;
    }
    const target = await db.collection("user").findOne({ _id: targetId });
    if (!target) {
      res.status(404).json({ message: "Kullanıcı bulunamadı." });
      return;
    }
    const inserted = await db.collection("subscriptions").insertOne({
      userId: targetId,
      startsAt: start,
      endsAt: end,
      note: typeof note === "string" && note ? note : null,
      createdBy: req.user!.id,
      createdAt: new Date(),
    });
    await logAudit(req.user!, "subscription-created", String(userId), {
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      subscriptionId: inserted.insertedId.toString(),
    });
    res.json({ ok: true, id: inserted.insertedId.toString() });
  },
);

adminRouter.get(
  "/users/:id/subscriptions",
  requireRole("admin", "staff"),
  async (req, res) => {
    const targetId = parseObjectId(String(req.params.id ?? ""));
    if (!targetId) {
      res.status(400).json({ message: "Geçersiz kullanıcı." });
      return;
    }
    const docs = await db
      .collection("subscriptions")
      .find({ userId: targetId })
      .sort({ endsAt: -1 })
      .limit(50)
      .toArray();
    res.json(
      docs.map((d) => ({
        id: d._id.toString(),
        userId: d.userId.toString(),
        startsAt: d.startsAt.toISOString(),
        endsAt: d.endsAt.toISOString(),
        note: d.note ?? undefined,
        createdBy: d.createdBy,
        createdAt: d.createdAt.toISOString(),
      })),
    );
  },
);

// Kurulum sihirbazı: salon ayarları (yalnızca admin)
adminRouter.get("/settings", requireRole("admin"), async (_req, res) => {
  const doc = await db.collection("settings").findOne({ _id: "gym" as never });
  const settings: GymSettings = {
    gymName: doc?.gymName ?? "",
    location: doc?.location ?? null,
    capacity: doc?.capacity ?? null,
  };
  res.json(settings);
});

adminRouter.put("/settings", requireRole("admin"), async (req, res) => {
  const { gymName, location, capacity } = req.body ?? {};
  if (typeof gymName !== "string" || !gymName.trim()) {
    res.status(400).json({ message: "Salon adı zorunludur." });
    return;
  }
  let loc: GymSettings["location"] = null;
  if (location != null) {
    const lat = Number(location.lat);
    const lng = Number(location.lng);
    const radiusM = Number(location.radiusM);
    if (
      Number.isNaN(lat) ||
      Number.isNaN(lng) ||
      Number.isNaN(radiusM) ||
      radiusM <= 0
    ) {
      res.status(400).json({ message: "Geçersiz konum bilgisi." });
      return;
    }
    loc = { lat, lng, radiusM };
  }
  const cap = capacity == null ? null : Number(capacity);
  if (cap !== null && (Number.isNaN(cap) || cap <= 0)) {
    res.status(400).json({ message: "Geçersiz kapasite." });
    return;
  }
  await db
    .collection("settings")
    .updateOne(
      { _id: "gym" as never },
      { $set: { gymName: gymName.trim(), location: loc, capacity: cap } },
      { upsert: true },
    );
  await logAudit(req.user!, "settings-updated", undefined, {
    gymName: gymName.trim(),
  });
  res.json({ ok: true });
});

// Audit log görüntüleme (yalnızca admin)
adminRouter.get("/audit", requireRole("admin"), async (_req, res) => {
  const docs = await db
    .collection("audit_logs")
    .find({})
    .sort({ at: -1 })
    .limit(100)
    .toArray();
  res.json(
    docs.map((d) => ({
      id: d._id.toString(),
      actorId: d.actorId,
      actorEmail: d.actorEmail,
      action: d.action,
      targetId: d.targetId ?? undefined,
      details: d.details ?? undefined,
      at: d.at.toISOString(),
    })),
  );
});

// Faz 4: turnike geçiş olayları (izin/red) — personel + admin
adminRouter.get(
  "/entry-events",
  requireRole("admin", "staff"),
  async (_req, res) => {
    const docs = await db
      .collection("entry_events")
      .find({})
      .sort({ at: -1 })
      .limit(100)
      .toArray();
    const body: EntryEvent[] = docs.map((d) => ({
      id: d._id.toString(),
      deviceId: d.deviceId,
      deviceName: d.deviceName,
      userId: d.userId ?? null,
      memberName: d.memberName ?? null,
      allowed: d.allowed,
      reason: d.reason ?? null,
      at: d.at.toISOString(),
    }));
    res.json(body);
  },
);
