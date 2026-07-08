import { auth } from "./auth.js";
import { db } from "./db.js";

export const INITIAL_ADMIN_EMAIL = "admin@opengym.local";
export const INITIAL_ADMIN_PASSWORD = "admin1234";

/**
 * İlk kurulum: hiç admin yoksa varsayılan admin hesabı oluşturur.
 * Hesap mustChangePassword=true ile açılır; ilk girişte şifre
 * değiştirilmeden hiçbir admin ucu çalışmaz (US-2).
 */
export async function seedInitialAdmin(): Promise<void> {
  const users = db.collection("user");
  const existingAdmin = await users.findOne({ role: "admin" });
  if (existingAdmin) return;

  await auth.api.signUpEmail({
    body: {
      email: INITIAL_ADMIN_EMAIL,
      password: INITIAL_ADMIN_PASSWORD,
      name: "Salon Yöneticisi",
      firstName: "Salon",
      lastName: "Yöneticisi",
      phone: "-",
      kvkkAccepted: true,
      privacyAccepted: true,
    },
  });

  await users.updateOne(
    { email: INITIAL_ADMIN_EMAIL },
    {
      $set: {
        role: "admin",
        mustChangePassword: true,
        emailVerified: true,
      },
    },
  );

  console.log(
    `[seed] İlk admin oluşturuldu: ${INITIAL_ADMIN_EMAIL} / ${INITIAL_ADMIN_PASSWORD} (ilk girişte şifre değişimi zorunlu)`,
  );
}
