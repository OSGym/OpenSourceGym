import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env.js";

// QR token imzalama anahtarı — sunucu sırrından türetilir, ayrıca saklanmaz
const qrKey = createHmac("sha256", env.betterAuthSecret)
  .update("opengym-qr-v1")
  .digest();

export const QR_TOKEN_TTL_SECONDS = 60;

interface QrPayload {
  u: string;
  j: string;
  e: number;
}

export type QrVerifyResult =
  | { ok: true; userId: string; jti: string; exp: number }
  | { ok: false; reason: "INVALID_TOKEN" | "EXPIRED" };

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payloadB64: string): string {
  return createHmac("sha256", qrKey).update(payloadB64).digest("base64url");
}

// Üyenin ekranında gösterilecek, kısa ömürlü ve imzalı turnike QR token'ı üretir
export function issueQrToken(userId: string): {
  token: string;
  expiresAt: Date;
} {
  const exp = Math.floor(Date.now() / 1000) + QR_TOKEN_TTL_SECONDS;
  const jti = randomBytes(8).toString("hex");
  const payload: QrPayload = { u: userId, j: jti, e: exp };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(payloadB64);
  const token = `OG1.${payloadB64}.${signature}`;
  return { token, expiresAt: new Date(exp * 1000) };
}

// Turnike cihazının okuttuğu QR token'ının imzasını ve geçerlilik süresini doğrular
export function verifyQrToken(token: string): QrVerifyResult {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "OG1") {
    return { ok: false, reason: "INVALID_TOKEN" };
  }
  const [, payloadB64, signature] = parts;
  if (!payloadB64 || !signature) {
    return { ok: false, reason: "INVALID_TOKEN" };
  }

  const expectedSignature = sign(payloadB64);
  const sigBuf = Buffer.from(signature, "base64url");
  const expectedBuf = Buffer.from(expectedSignature, "base64url");
  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return { ok: false, reason: "INVALID_TOKEN" };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
  } catch {
    return { ok: false, reason: "INVALID_TOKEN" };
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as QrPayload).u !== "string" ||
    typeof (payload as QrPayload).j !== "string" ||
    typeof (payload as QrPayload).e !== "number"
  ) {
    return { ok: false, reason: "INVALID_TOKEN" };
  }

  const { u, j, e } = payload as QrPayload;
  if (e < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "EXPIRED" };
  }

  return { ok: true, userId: u, jti: j, exp: e };
}
