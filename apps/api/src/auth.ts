import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { emailOTP, twoFactor } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { db } from "./db.js";
import { redis } from "./redis.js";
import { sendMail } from "./mailer.js";
import { env } from "./env.js";
import { enforceSessionPolicy } from "./sharing.js";
import { revokeUserSessions } from "./sessions.js";

export const auth = betterAuth({
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
  // "opengym://" mobil uygulamanın deep-link scheme'i (@better-auth/expo).
  // "exp://" yalnızca geliştirmede: Expo Go istemcisi exp://<lan-ip>:8081 origin'i gönderir.
  trustedOrigins: [
    ...env.trustedOrigins,
    "opengym://",
    ...(env.nodeEnv !== "production" ? ["exp://"] : []),
  ],
  database: mongodbAdapter(db),

  secondaryStorage: {
    get: (key) => redis.get(key),
    set: async (key, value, ttl) => {
      if (ttl) {
        await redis.set(key, value, { EX: ttl });
      } else {
        await redis.set(key, value);
      }
    },
    delete: async (key) => {
      await redis.del(key);
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true,
    // BetterAuth'un kendi revokeSessionsOnPasswordReset'i yalnızca Redis
    // "active-sessions-<userId>" listesindeki token'ları siler; Faz 6'nın
    // enforceSessionPolicy eviction'ı (sharing.ts) o listeyi hayatta kalan
    // oturumları yeniden yazmadan tamamen siler, bu yüzden liste zaten
    // boşalmış kullanıcılarda hayatta kalan Redis oturum blob'ları asla
    // silinmez ve findSession Mongo'ya hiç bakmadan onları geçerli kabul
    // eder. revokeUserSessions() token'ları Mongo'dan (referans doğruluk)
    // okuduğundan bu listeye bağımlı değildir. mustChangePassword'a
    // dokunmaz — yalnızca oturum iptali için eklenmiştir.
    onPasswordReset: async ({ user }) => {
      await revokeUserSessions(user.id);
    },
  },

  user: {
    additionalFields: {
      firstName: { type: "string", required: true },
      lastName: { type: "string", required: true },
      phone: { type: "string", required: true },
      role: { type: "string", required: false, defaultValue: "member", input: false },
      mustChangePassword: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      kvkkAccepted: { type: "boolean", required: true },
      privacyAccepted: { type: "boolean", required: true },
      kvkkAcceptedAt: { type: "date", required: false, input: false },
      privacyAcceptedAt: { type: "date", required: false, input: false },
    },
  },

  session: {
    // secondaryStorage (Redis) etkinken oturum belgeleri varsayılan olarak
    // Mongo'ya YAZILMAZ (yalnızca Redis'te tutulur). Faz 6'nın eşzamanlı
    // oturum sınırı / cihaz parmak izi churn tespiti Mongo'daki "session"
    // koleksiyonunu sorguladığından bu açıkça etkinleştirilir; okumalar yine
    // de Redis'ten yapılmaya devam eder (performans kaybı yok)
    storeSessionInDatabase: true,
    additionalFields: {
      deviceFingerprint: { type: "string", required: false, input: false },
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const candidate = user as typeof user & {
            kvkkAccepted?: boolean;
            privacyAccepted?: boolean;
          };
          if (!candidate.kvkkAccepted || !candidate.privacyAccepted) {
            throw new APIError("BAD_REQUEST", {
              message:
                "KVKK aydınlatma metni ve gizlilik sözleşmesi onayları zorunludur.",
            });
          }
          const now = new Date();
          return {
            data: {
              ...user,
              role: "member",
              kvkkAcceptedAt: now,
              privacyAcceptedAt: now,
            },
          };
        },
      },
    },
    // Faz 6 — hesap paylaşımı tespiti: girişte cihaz parmak izini oturuma
    // damgalar ve oturum oluşturulduktan sonra eşzamanlı oturum sınırı /
    // parmak izi churn tespitini uygular
    session: {
      create: {
        before: async (session, ctx) => {
          const candidate = session as typeof session & {
            deviceFingerprint?: string;
          };
          const fp =
            ctx?.headers?.get?.("x-device-fingerprint") ??
            ctx?.request?.headers?.get?.("x-device-fingerprint") ??
            null;
          if (fp && /^[a-f0-9]{64}$/.test(fp)) {
            return { data: { ...candidate, deviceFingerprint: fp } };
          }
        },
        after: async (session) => {
          try {
            await enforceSessionPolicy(
              session as unknown as { userId: string },
            );
          } catch (err) {
            console.error("session policy enforcement failed:", err);
          }
        },
      },
    },
  },

  plugins: [
    expo(),
    emailOTP({
      sendVerificationOnSignUp: true,
      otpLength: 6,
      expiresIn: 600,
      storeOTP: "hashed",
      resendStrategy: "rotate",
      async sendVerificationOTP({ email, otp, type }) {
        const subjects: Record<string, string> = {
          "email-verification": "OpenGym e-posta doğrulama kodunuz",
          "sign-in": "OpenGym giriş kodunuz",
          "forget-password": "OpenGym şifre sıfırlama kodunuz",
        };
        await sendMail({
          to: email,
          subject: subjects[type] ?? "OpenGym doğrulama kodunuz",
          text: `Doğrulama kodunuz: ${otp}\nKod 10 dakika geçerlidir.`,
        });
      },
    }),
    // Faz 5 — US-3: hassas admin işlemleri (rol atama) için MFA. Mongo adapter
    // "twoFactor" koleksiyonunu göç (migration) gerektirmeden otomatik oluşturur
    twoFactor({
      issuer: "OpenGym",
      otpOptions: {
        storeOTP: "hashed",
        async sendOTP({ user, otp }) {
          await sendMail({
            to: user.email,
            subject: "OpenGym güvenlik kodunuz",
            text: `Güvenlik kodunuz: ${otp}\nKod 3 dakika geçerlidir.`,
          });
        },
      },
    }),
  ],

  rateLimit: {
    enabled: true,
    storage: "secondary-storage",
    window: 60,
    max: 60,
    customRules: {
      "/sign-up/email": { window: 60, max: 3 },
      "/sign-in/email": { window: 60, max: 5 },
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
      "/email-otp/verify-email": { window: 60, max: 5 },
      "/email-otp/request-password-reset": { window: 60, max: 3 },
      "/email-otp/reset-password": { window: 60, max: 5 },
      "/two-factor/send-otp": { window: 60, max: 3 },
      "/two-factor/verify-totp": { window: 60, max: 5 },
      "/two-factor/verify-otp": { window: 60, max: 5 },
    },
  },
});
