import type { NextFunction, Request, Response } from "express";
import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import type { Role } from "@opengym/shared";
import { auth } from "./auth.js";
import { db } from "./db.js";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export function requireRole(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      res.status(401).json({ message: "Oturum gerekli." });
      return;
    }
    // Session cache'i (Redis) rol/bayrak değişikliklerini geriden takip eder;
    // yetki kararları her istekte DB'deki güncel kayda göre verilir
    const doc = await db
      .collection("user")
      .findOne({ _id: new ObjectId(session.user.id) });
    if (!doc) {
      res.status(401).json({ message: "Oturum gerekli." });
      return;
    }
    const user: SessionUser = {
      id: session.user.id,
      email: doc.email,
      name: doc.name,
      role: (doc.role ?? "member") as Role,
      mustChangePassword: doc.mustChangePassword ?? false,
      twoFactorEnabled: doc.twoFactorEnabled ?? false,
    };
    if (!roles.includes(user.role)) {
      res.status(403).json({ message: "Bu işlem için yetkiniz yok." });
      return;
    }
    // US-2: zorunlu şifre değişimi yapılmadan yalnızca şifre değiştirme ve
    // profil uçları çalışır
    const exemptPaths = ["/initial-password", "/profile"];
    if (user.mustChangePassword && !exemptPaths.includes(req.path)) {
      res.status(403).json({
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "Devam etmeden önce şifrenizi değiştirmelisiniz.",
      });
      return;
    }
    req.user = user;
    next();
  };
}
