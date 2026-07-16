import type { NextFunction, Request, Response } from "express";
import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import type { MyProfile, Role } from "@opengym/shared";
import { auth } from "./auth.js";
import { sendApiError } from "./apiError.js";
import { db } from "./db.js";
import { buildProfilePhotoUrl } from "./profilePhoto.js";

export type SessionUser = MyProfile;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
      /** Faz 6: BetterAuth oturum token'ı — cihaz kimliği fallback'i olarak kullanılır */
      sessionToken?: string;
    }
  }
}

export function requireRole(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      sendApiError(res, 401, "AUTH_REQUIRED", "Oturum gerekli.");
      return;
    }
    req.sessionToken = session.session.token;
    // Session cache'i (Redis) rol/bayrak değişikliklerini geriden takip eder;
    // yetki kararları her istekte DB'deki güncel kayda göre verilir
    const doc = await db
      .collection("user")
      .findOne({ _id: new ObjectId(session.user.id) });
    if (!doc) {
      sendApiError(res, 401, "AUTH_REQUIRED", "Oturum gerekli.");
      return;
    }
    const user: SessionUser = {
      id: session.user.id,
      email: doc.email,
      name: doc.name,
      role: (doc.role ?? "member") as Role,
      mustChangePassword: doc.mustChangePassword ?? false,
      twoFactorEnabled: doc.twoFactorEnabled ?? false,
      profilePhotoUrl: buildProfilePhotoUrl(
        doc.profilePhotoKey,
        doc.profilePhotoUpdatedAt,
      ),
    };
    if (!roles.includes(user.role)) {
      sendApiError(res, 403, "FORBIDDEN", "Bu işlem için yetkiniz yok.");
      return;
    }
    // US-2: zorunlu şifre değişimi yapılmadan yalnızca şifre değiştirme ve
    // profil uçları çalışır
    const exemptPaths = ["/initial-password", "/profile"];
    if (user.mustChangePassword && !exemptPaths.includes(req.path)) {
      sendApiError(
        res,
        403,
        "PASSWORD_CHANGE_REQUIRED",
        "Devam etmeden önce şifrenizi değiştirmelisiniz.",
      );
      return;
    }
    req.user = user;
    next();
  };
}
