export interface HealthResponse {
  status: "ok";
  service: string;
  timestamp: string;
}

export type Role = "admin" | "staff" | "member";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: Role;
  emailVerified: boolean;
  createdAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  startsAt: string;
  endsAt: string;
  note?: string;
  createdBy: string;
  createdAt: string;
}

export interface MySubscription {
  active: boolean;
  endsAt: string | null;
  remainingDays: number;
}

export interface GymSettings {
  gymName: string;
  location: {
    lat: number;
    lng: number;
    radiusM: number;
  } | null;
  capacity: number | null;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetId?: string;
  details?: Record<string, unknown>;
  at: string;
}

// ---- Faz 4: Turnike / QR / Device Gateway ----

/** QR üretim isteğinin red nedenleri (HTTP 403 body.code) */
export type QrRejectCode =
  | "NO_ACTIVE_SUBSCRIPTION"
  | "LOCATION_REQUIRED"
  | "OUT_OF_RANGE";

export interface QrTokenResponse {
  /** Turnikede okutulacak imzalı, kısa ömürlü token (QR içeriği) */
  token: string;
  expiresAt: string;
  /** En az bir turnike cihazı bağlı mı (kopuksa üyeye uyarı gösterilir) */
  gatewayOnline: boolean;
}

export interface Device {
  id: string;
  name: string;
  online: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

/** Cihaz oluşturma yanıtı — token yalnızca bu yanıtta bir kez görünür */
export interface DeviceCreated {
  id: string;
  name: string;
  token: string;
}

/** Tarama anında geçişin reddedilme nedenleri */
export type EntryDenyReason =
  | "INVALID_TOKEN"
  | "EXPIRED"
  | "REPLAY"
  | "NO_ACTIVE_SUBSCRIPTION";

export interface EntryEvent {
  id: string;
  deviceId: string;
  deviceName: string;
  userId: string | null;
  memberName: string | null;
  allowed: boolean;
  reason: EntryDenyReason | null;
  at: string;
}

// Device Gateway WS protokolü (JSON text frame, cihaz ↔ sunucu)
export type DeviceClientMessage =
  | { type: "auth"; deviceId: string; token: string }
  | { type: "scan"; qr: string };

export type DeviceServerMessage =
  | { type: "auth_ok"; deviceName: string }
  | { type: "auth_error"; message: string }
  | {
      type: "scan_result";
      allow: boolean;
      reason?: EntryDenyReason;
      memberName?: string;
      /** Röle tetikleme süresi (ms) — cihaz bu süre kadar açar */
      openMs?: number;
    };
