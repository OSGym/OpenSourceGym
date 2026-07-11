import { Router } from "express";
import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import type {
  DeletionRequest,
  EntryEvent,
  GymSettings,
  PublicUser,
  Role,
} from "@opengym/shared";
import { auth } from "../auth.js";
import { db } from "../db.js";
import { redis } from "../redis.js";
import { logAudit } from "../audit.js";
import { requireRole } from "../middleware.js";
import { markOutside } from "../occupancy.js";
import { revokeUserSessions } from "../sessions.js";
import { SHARING_DEFAULTS } from "../sharing.js";

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
  twoFactorEnabled?: boolean;
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
    twoFactorEnabled: doc.twoFactorEnabled ?? false,
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

const mfaSchema = z.object({
  mfaCode: z.string().min(1),
  mfaMethod: z.enum(["totp", "otp"]),
});

// US-3: rol atama (yalnızca admin) — çağıranın MFA'sı etkinse ek doğrulama gerekir
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

  // MFA etkin adminler için rol atama, TOTP veya OTP ile ek doğrulama gerektirir
  let mfaVerified = false;
  if (req.user!.twoFactorEnabled) {
    const parsedMfa = mfaSchema.safeParse(req.body);
    if (!parsedMfa.success) {
      res.status(403).json({
        code: "MFA_REQUIRED",
        message: "Bu işlem için MFA doğrulaması gerekli.",
      });
      return;
    }
    const { mfaCode, mfaMethod } = parsedMfa.data;

    // Kaba kuvvet kilidi: BetterAuth'un HTTP hız sınırı doğrudan auth.api.*
    // çağrılarını KAPSAMAZ — deneme sayacı burada tutulur (15 dk / 5 hatalı kod)
    const mfaFailKey = `og:mfa-fail:${req.user!.id}`;
    const failCount = Number((await redis.get(mfaFailKey)) ?? 0);
    if (failCount >= 5) {
      res.status(429).json({
        code: "MFA_LOCKED",
        message:
          "Çok fazla hatalı kod denemesi. 15 dakika sonra tekrar deneyin.",
      });
      return;
    }

    try {
      const headers = fromNodeHeaders(req.headers);
      if (mfaMethod === "totp") {
        await auth.api.verifyTOTP({ body: { code: mfaCode }, headers });
      } else {
        await auth.api.verifyTwoFactorOTP({ body: { code: mfaCode }, headers });
      }
      mfaVerified = true;
      await redis.del(mfaFailKey);
    } catch {
      const fails = await redis.incr(mfaFailKey);
      if (fails === 1) {
        await redis.expire(mfaFailKey, 900);
      }
      res.status(403).json({
        code: "MFA_INVALID",
        message: "Doğrulama kodu geçersiz veya süresi dolmuş.",
      });
      return;
    }
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
    mfaVerified,
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
    autoExitHours: doc?.autoExitHours ?? 4,
    sharing: { ...SHARING_DEFAULTS, ...(doc?.sharing ?? {}) },
  };
  res.json(settings);
});

const sharingSchema = z.object({
  memberMaxSessions: z.number().int().min(1).max(10),
  staffMaxSessions: z.number().int().min(1).max(20),
  signalThreshold: z.number().int().min(1).max(20),
  signalWindowHours: z.number().int().min(1).max(168),
  qrBlockHours: z.number().int().min(1).max(168),
});

adminRouter.put("/settings", requireRole("admin"), async (req, res) => {
  const { gymName, location, capacity, autoExitHours } = req.body ?? {};
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
  const autoExit = autoExitHours == null ? 4 : Number(autoExitHours);
  if (
    !Number.isInteger(autoExit) ||
    autoExit < 1 ||
    autoExit > 48
  ) {
    res.status(400).json({ message: "Geçersiz otomatik çıkış süresi." });
    return;
  }

  // Faz 6: paylaşım tespiti ayarları yalnızca istek gövdesinde mevcutsa
  // güncellenir — mevcut ayarlanmış değerleri sessizce ezmemesi kritiktir
  const setDoc: Record<string, unknown> = {
    gymName: gymName.trim(),
    location: loc,
    capacity: cap,
    autoExitHours: autoExit,
  };
  if (req.body?.sharing !== undefined) {
    const parsedSharing = sharingSchema.safeParse(req.body.sharing);
    if (!parsedSharing.success) {
      res.status(400).json({ message: "Geçersiz paylaşım tespiti ayarları." });
      return;
    }
    setDoc.sharing = parsedSharing.data;
  }

  await db.collection("settings").updateOne(
    { _id: "gym" as never },
    { $set: setDoc },
    { upsert: true },
  );
  await logAudit(req.user!, "settings-updated", undefined, {
    gymName: gymName.trim(),
    autoExitHours: autoExit,
    ...(setDoc.sharing !== undefined ? { sharing: setDoc.sharing } : {}),
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

// Faz 5 — KVKK: bekleyen hesap silme talepleri listesi (yalnızca admin)
adminRouter.get("/deletion-requests", requireRole("admin"), async (_req, res) => {
  const docs = await db
    .collection("deletion_requests")
    .find({})
    .sort({ requestedAt: -1 })
    .limit(100)
    .toArray();
  const body: DeletionRequest[] = docs.map((d) => ({
    id: d._id.toString(),
    userId: (d.userId as ObjectId).toString(),
    email: d.email ?? "",
    name: d.name ?? "",
    requestedAt: d.requestedAt.toISOString(),
    status: d.status,
    resolvedAt: d.resolvedAt ? new Date(d.resolvedAt).toISOString() : null,
    resolvedBy: d.resolvedBy ?? null,
  }));
  res.json(body);
});

// KVKK: silme talebini onaylar — üyeyi ve tüm ilişkili verilerini kalıcı olarak siler
adminRouter.post(
  "/deletion-requests/:id/approve",
  requireRole("admin"),
  async (req, res) => {
    const requestId = parseObjectId(String(req.params.id ?? ""));
    if (!requestId) {
      res.status(404).json({ message: "Silme talebi bulunamadı." });
      return;
    }
    const request = await db
      .collection("deletion_requests")
      .findOne({ _id: requestId });
    if (!request) {
      res.status(404).json({ message: "Silme talebi bulunamadı." });
      return;
    }
    if (request.status !== "pending") {
      res.status(409).json({ message: "Silme talebi zaten sonuçlandırılmış." });
      return;
    }

    const targetId = request.userId as ObjectId;
    const targetIdStr = targetId.toString();

    // Kullanıcının tüm oturumları (Redis + Mongo) iptal edilir; uygulama
    // rotaları zaten middleware'in Mongo re-read'iyle 401'e düşer
    await revokeUserSessions(targetIdStr);

    await db.collection("user").deleteOne({ _id: targetId });
    await db.collection("account").deleteMany({ userId: targetId });
    await db.collection("subscriptions").deleteMany({ userId: targetId });
    await db.collection("twoFactor").deleteMany({ userId: targetId });
    await markOutside(targetIdStr);
    // Geçmiş turnike kayıtları istatistik için tutulur, ancak kişisel veri
    // (KVKK) taşımamalıdır
    await db
      .collection("entry_events")
      .updateMany(
        { userId: targetIdStr },
        { $set: { userId: null, memberName: null } },
      );
    // Audit kayıtlarında da silinen üyenin e-postası kalmamalı (unutulma hakkı);
    // eylem geçmişi actorId üzerinden anonim olarak korunur
    await db
      .collection("audit_logs")
      .updateMany({ actorId: targetIdStr }, { $set: { actorEmail: null } });

    // Kullanıcının TÜM talepleri (önceki reddedilenler dahil) PII taşımamalı
    await db
      .collection("deletion_requests")
      .updateMany({ userId: targetId }, { $set: { email: null, name: null } });
    await db.collection("deletion_requests").updateOne(
      { _id: requestId },
      {
        $set: {
          status: "approved",
          resolvedAt: new Date(),
          resolvedBy: req.user!.id,
        },
      },
    );

    await logAudit(req.user!, "kvkk-deletion-approved", targetIdStr);
    res.json({ ok: true });
  },
);

// KVKK: silme talebini reddeder
adminRouter.post(
  "/deletion-requests/:id/reject",
  requireRole("admin"),
  async (req, res) => {
    const requestId = parseObjectId(String(req.params.id ?? ""));
    if (!requestId) {
      res.status(404).json({ message: "Silme talebi bulunamadı." });
      return;
    }
    const request = await db
      .collection("deletion_requests")
      .findOne({ _id: requestId });
    if (!request) {
      res.status(404).json({ message: "Silme talebi bulunamadı." });
      return;
    }
    if (request.status !== "pending") {
      res.status(409).json({ message: "Silme talebi zaten sonuçlandırılmış." });
      return;
    }
    await db.collection("deletion_requests").updateOne(
      { _id: requestId },
      {
        $set: {
          status: "rejected",
          resolvedAt: new Date(),
          resolvedBy: req.user!.id,
        },
      },
    );
    await logAudit(
      req.user!,
      "kvkk-deletion-rejected",
      (request.userId as ObjectId).toString(),
    );
    res.json({ ok: true });
  },
);
