import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { emailOTP } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { db } from "./db.js";
import { redis } from "./redis.js";
import { sendMail } from "./mailer.js";
import { env } from "./env.js";

export const auth = betterAuth({
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
  // "opengym://" mobil uygulamanın deep-link scheme'i (@better-auth/expo)
  trustedOrigins: [...env.trustedOrigins, "opengym://"],
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
  },

  plugins: [
    expo(),
    emailOTP({
      sendVerificationOnSignUp: true,
      otpLength: 6,
      expiresIn: 600,
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
    },
  },
});
