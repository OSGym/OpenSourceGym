import { Router } from "express";
import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import type {
  AdminStats,
  DeletionRequest,
  EntryEvent,
  GymSettings,
  PublicUser,
  Role,
} from "@opengym/shared";
import { auth } from "../auth.js";
import { sendApiError } from "../apiError.js";
import { db } from "../db.js";
import { redis } from "../redis.js";
import { logAudit } from "../audit.js";
import { requireRole } from "../middleware.js";
import { markOutside } from "../occupancy.js";
import { revokeUserSessions } from "../sessions.js";
import {
  buildProfilePhotoUrl,
  deleteUserProfilePhotoForAccountDeletion,
} from "../profilePhoto.js";
import { SHARING_DEFAULTS } from "../sharing.js";
import {
  createSequentialSubscription,
  listUserSubscriptions,
  SubscriptionLockTimeoutError,
} from "../subscriptions.js";
import { tryNormalizePhoneToE164 } from "../phone.js";
import {
  buildUserSearchFilter,
  parseUserSearchQuery,
  USER_SEARCH_LIMIT,
} from "../userSearch.js";
import {
  findActivePhoneConflictUserIds,
  reconcilePhoneConflictsAfterUserChange,
} from "../phoneBackfill.js";

export const adminRouter: Router = Router();

function toPublicUser(doc: {
  _id: ObjectId;
  name?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  phoneE164?: string;
  role?: string;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
  profilePhotoKey?: string;
  profilePhotoUpdatedAt?: Date;
  createdAt?: Date;
}): PublicUser {
  return {
    id: doc._id.toString(),
    name: doc.name ?? "",
    email: doc.email ?? "",
    firstName: doc.firstName ?? "",
    lastName: doc.lastName ?? "",
    phone:
      doc.phoneE164 ?? tryNormalizePhoneToE164(doc.phone) ?? doc.phone ?? "",
    role: (doc.role ?? "member") as Role,
    emailVerified: doc.emailVerified ?? false,
    twoFactorEnabled: doc.twoFactorEnabled ?? false,
    profilePhotoUrl: buildProfilePhotoUrl(
      doc.profilePhotoKey,
      doc.profilePhotoUpdatedAt,
    ),
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
      sendApiError(
        res,
        400,
        "PASSWORD_TOO_SHORT",
        "Yeni şifre en az 8 karakter olmalıdır.",
      );
      return;
    }
    try {
      await auth.api.changePassword({
        headers: fromNodeHeaders(req.headers),
        body: { currentPassword, newPassword, revokeOtherSessions: false },
      });
    } catch {
      sendApiError(
        res,
        400,
        "CURRENT_PASSWORD_INVALID",
        "Mevcut şifre hatalı.",
      );
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

// US-3: telefon, e-posta, ad veya soyad ile üye arama (personel + admin)
adminRouter.get("/users", requireRole("admin", "staff"), async (req, res) => {
  const query = parseUserSearchQuery(req.query.q);
  if (!query) {
    sendApiError(
      res,
      400,
      "SEARCH_QUERY_TOO_SHORT",
      "Arama için en az iki karakter girin.",
    );
    return;
  }
  const phoneE164 = tryNormalizePhoneToE164(query);
  const conflictUserIds = phoneE164
    ? await findActivePhoneConflictUserIds(phoneE164)
    : [];
  const docs = await db
    .collection("user")
    .find(buildUserSearchFilter(query, conflictUserIds))
    .limit(USER_SEARCH_LIMIT)
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
    sendApiError(
      res,
      400,
      "INVALID_USER_OR_ROLE",
      "Geçersiz kullanıcı veya rol.",
    );
    return;
  }
  // ObjectId.equals ile karşılaştır: ham string eşitliği kanonik olmayan
  // hex (ör. büyük harf) girdisinde kendi rolünü değiştirme korumasını atlatır
  if (targetId.equals(req.user!.id)) {
    sendApiError(
      res,
      400,
      "SELF_ROLE_CHANGE",
      "Kendi rolünüzü değiştiremezsiniz.",
    );
    return;
  }

  // MFA etkin adminler için rol atama, TOTP veya OTP ile ek doğrulama gerektirir
  let mfaVerified = false;
  if (req.user!.twoFactorEnabled) {
    const parsedMfa = mfaSchema.safeParse(req.body);
    if (!parsedMfa.success) {
      sendApiError(
        res,
        403,
        "MFA_REQUIRED",
        "Bu işlem için MFA doğrulaması gerekli.",
      );
      return;
    }
    const { mfaCode, mfaMethod } = parsedMfa.data;

    // Kaba kuvvet kilidi: BetterAuth'un HTTP hız sınırı doğrudan auth.api.*
    // çağrılarını KAPSAMAZ — deneme sayacı burada tutulur (15 dk / 5 hatalı kod)
    const mfaFailKey = `og:mfa-fail:${req.user!.id}`;
    const failCount = Number((await redis.get(mfaFailKey)) ?? 0);
    if (failCount >= 5) {
      sendApiError(
        res,
        429,
        "MFA_LOCKED",
        "Çok fazla hatalı kod denemesi. 15 dakika sonra tekrar deneyin.",
      );
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
      sendApiError(
        res,
        403,
        "MFA_INVALID",
        "Doğrulama kodu geçersiz veya süresi dolmuş.",
      );
      return;
    }
  }

  const result = await db
    .collection("user")
    .findOneAndUpdate({ _id: targetId }, { $set: { role } });
  if (!result) {
    sendApiError(res, 404, "USER_NOT_FOUND", "Kullanıcı bulunamadı.");
    return;
  }
  await logAudit(req.user!, "role-assigned", idParam, {
    previousRole: result.role ?? "member",
    newRole: role,
    mfaVerified,
  });
  res.json({ ok: true });
});

const createSubscriptionSchema = z
  .object({
    userId: z.string(),
    months: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

// US-6: abonelik tanımlama/uzatma (personel + admin)
adminRouter.post(
  "/subscriptions",
  requireRole("admin", "staff"),
  async (req, res) => {
    const parsed = createSubscriptionSchema.safeParse(req.body ?? {});
    const targetId = parsed.success ? parseObjectId(parsed.data.userId) : null;
    if (!parsed.success || !targetId) {
      sendApiError(
        res,
        400,
        "INVALID_SUBSCRIPTION",
        "Geçerli kullanıcı ve abonelik paketi girin.",
      );
      return;
    }
    const target = await db.collection("user").findOne({ _id: targetId });
    if (!target) {
      sendApiError(res, 404, "USER_NOT_FOUND", "Kullanıcı bulunamadı.");
      return;
    }
    try {
      const created = await createSequentialSubscription({
        userId: targetId,
        months: parsed.data.months,
        note: parsed.data.note || null,
        createdBy: req.user!.id,
      });
      await logAudit(req.user!, "subscription-created", parsed.data.userId, {
        months: parsed.data.months,
        startsAt: created.startsAt.toISOString(),
        endsAt: created.endsAt.toISOString(),
        subscriptionId: created.id.toHexString(),
      });
      res.json({
        ok: true,
        id: created.id.toHexString(),
        startsAt: created.startsAt.toISOString(),
        endsAt: created.endsAt.toISOString(),
      });
    } catch (error) {
      if (error instanceof SubscriptionLockTimeoutError) {
        sendApiError(
          res,
          503,
          "SUBSCRIPTION_BUSY",
          "Abonelik işlemi sürüyor. Lütfen tekrar deneyin.",
        );
        return;
      }
      throw error;
    }
  },
);

adminRouter.get(
  "/users/:id/subscriptions",
  requireRole("admin", "staff"),
  async (req, res) => {
    const targetId = parseObjectId(String(req.params.id ?? ""));
    if (!targetId) {
      sendApiError(res, 400, "INVALID_USER", "Geçersiz kullanıcı.");
      return;
    }
    const docs = await listUserSubscriptions(targetId);
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
    sendApiError(res, 400, "GYM_NAME_REQUIRED", "Salon adı zorunludur.");
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
      sendApiError(res, 400, "INVALID_LOCATION", "Geçersiz konum bilgisi.");
      return;
    }
    loc = { lat, lng, radiusM };
  }
  const cap = capacity == null ? null : Number(capacity);
  if (cap !== null && (Number.isNaN(cap) || cap <= 0)) {
    sendApiError(res, 400, "INVALID_CAPACITY", "Geçersiz kapasite.");
    return;
  }
  const autoExit = autoExitHours == null ? 4 : Number(autoExitHours);
  if (!Number.isInteger(autoExit) || autoExit < 1 || autoExit > 48) {
    sendApiError(
      res,
      400,
      "INVALID_AUTO_EXIT",
      "Geçersiz otomatik çıkış süresi.",
    );
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
      sendApiError(
        res,
        400,
        "INVALID_SHARING_SETTINGS",
        "Geçersiz paylaşım tespiti ayarları.",
      );
      return;
    }
    setDoc.sharing = parsedSharing.data;
  }

  await db
    .collection("settings")
    .updateOne({ _id: "gym" as never }, { $set: setDoc }, { upsert: true });
  await logAudit(req.user!, "settings-updated", undefined, {
    gymName: gymName.trim(),
    autoExitHours: autoExit,
    ...(setDoc.sharing !== undefined ? { sharing: setDoc.sharing } : {}),
  });
  res.json({ ok: true });
});

// Genel bakış paneli KPI'ları (personel + admin)
adminRouter.get("/stats", requireRole("admin", "staff"), async (_req, res) => {
  const now = new Date();
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const subs = db.collection("subscriptions");
  const [activeMembers, renewalsDue] = await Promise.all([
    subs.distinct("userId", { startsAt: { $lte: now }, endsAt: { $gte: now } }),
    subs.distinct("userId", {
      startsAt: { $lte: now },
      endsAt: { $gte: now, $lte: in7d },
    }),
  ]);
  const body: AdminStats = {
    activeMembers: activeMembers.length,
    renewalsDue: renewalsDue.length,
  };
  res.json(body);
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
adminRouter.get(
  "/deletion-requests",
  requireRole("admin"),
  async (_req, res) => {
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
  },
);

// KVKK: silme talebini onaylar — üyeyi ve tüm ilişkili verilerini kalıcı olarak siler
adminRouter.post(
  "/deletion-requests/:id/approve",
  requireRole("admin"),
  async (req, res) => {
    const requestId = parseObjectId(String(req.params.id ?? ""));
    if (!requestId) {
      sendApiError(
        res,
        404,
        "DELETION_REQUEST_NOT_FOUND",
        "Silme talebi bulunamadı.",
      );
      return;
    }
    // TOCTOU koruması: talebi pending→approved atomik olarak sahiplen. İki
    // admin aynı anda onaylarsa yalnızca biri eşleşir; diğeri 409 alır
    // (mükerrer denetim kaydı ve işlem tekrarı önlenir).
    const claim = await db.collection("deletion_requests").updateOne(
      { _id: requestId, status: "pending" },
      {
        $set: {
          status: "approved",
          resolvedAt: new Date(),
          resolvedBy: req.user!.id,
        },
      },
    );
    if (claim.matchedCount === 0) {
      const existing = await db
        .collection("deletion_requests")
        .findOne({ _id: requestId }, { projection: { _id: 1 } });
      sendApiError(
        res,
        existing ? 409 : 404,
        existing ? "DELETION_REQUEST_RESOLVED" : "DELETION_REQUEST_NOT_FOUND",
        existing
          ? "Silme talebi zaten sonuçlandırılmış."
          : "Silme talebi bulunamadı.",
      );
      return;
    }
    // Sahiplenme başarılı; hedef kullanıcı kimliğini oku (kayıt kesin var)
    const request = await db
      .collection("deletion_requests")
      .findOne({ _id: requestId });
    const targetId = request!.userId as ObjectId;
    const targetIdStr = targetId.toString();

    // Kullanıcının tüm oturumları (Redis + Mongo) iptal edilir; uygulama
    // rotaları zaten middleware'in Mongo re-read'iyle 401'e düşer
    await revokeUserSessions(targetIdStr);

    try {
      await deleteUserProfilePhotoForAccountDeletion(targetIdStr);
    } catch (error) {
      console.error("KVKK profil fotoğrafı silinemedi", error);
      // Temizlik başarısız: talebi pending'e geri al ki yönetici yeniden
      // deneyebilsin (fail-closed — kullanıcı verisi henüz silinmedi)
      await db.collection("deletion_requests").updateOne(
        { _id: requestId },
        {
          $set: { status: "pending" },
          $unset: { resolvedAt: "", resolvedBy: "" },
        },
      );
      sendApiError(
        res,
        503,
        "DELETION_CLEANUP_FAILED",
        "Profil fotoğrafı depolama alanından silinemedi. Lütfen tekrar deneyin.",
      );
      return;
    }

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

    // Kullanıcının TÜM talepleri (önceki reddedilenler dahil) PII taşımamalı.
    // Bu talebin status/resolvedAt/resolvedBy alanları başta atomik olarak
    // sahiplenilirken zaten yazıldı; burada yalnızca PII temizlenir.
    await db
      .collection("deletion_requests")
      .updateMany({ userId: targetId }, { $set: { email: null, name: null } });

    // Mükerrer telefon çatışma kayıtlarından silinen kullanıcının PII'sini
    // kaldırır; tek hesap kaldıysa onu E.164'e taşıyıp çatışma kaydını siler.
    await reconcilePhoneConflictsAfterUserChange(targetIdStr);

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
      sendApiError(
        res,
        404,
        "DELETION_REQUEST_NOT_FOUND",
        "Silme talebi bulunamadı.",
      );
      return;
    }
    const request = await db
      .collection("deletion_requests")
      .findOne({ _id: requestId });
    if (!request) {
      sendApiError(
        res,
        404,
        "DELETION_REQUEST_NOT_FOUND",
        "Silme talebi bulunamadı.",
      );
      return;
    }
    if (request.status !== "pending") {
      sendApiError(
        res,
        409,
        "DELETION_REQUEST_RESOLVED",
        "Silme talebi zaten sonuçlandırılmış.",
      );
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
