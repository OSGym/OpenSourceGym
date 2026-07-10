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
  /** MFA (iki aşamalı doğrulama) etkin mi — Faz 5 */
  twoFactorEnabled: boolean;
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

export type SubscriptionMonths = 1 | 3 | 6 | 12;

export interface CreateSubscriptionRequest {
  userId: string;
  months: SubscriptionMonths;
  note?: string;
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
  /** Çıkış turnikesi yoksa üyenin "içeride" sayılacağı azami süre (saat) — Faz 5 doluluk */
  autoExitHours: number;
  /** Hesap paylaşımı tespiti ayarları — Faz 6 */
  sharing: SharingConfig;
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
  | "OUT_OF_RANGE"
  | "MOCK_LOCATION"
  | "SHARING_BLOCKED";

export interface QrTokenResponse {
  /** Turnikede okutulacak imzalı, kısa ömürlü token (QR içeriği) */
  token: string;
  expiresAt: string;
  /** En az bir turnike cihazı bağlı mı (kopuksa üyeye uyarı gösterilir) */
  gatewayOnline: boolean;
}

/** Turnike yönü: "in" giriş (doluluk +1), "out" çıkış (doluluk -1, abonelik kontrolü atlanır) */
export type DeviceDirection = "in" | "out";

export interface Device {
  id: string;
  name: string;
  direction: DeviceDirection;
  online: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  /** Son 24 saatte çevrimiçi kalma yüzdesi (0-100) — KPI-4 */
  uptime24h: number;
}

/** Cihaz oluşturma yanıtı — token yalnızca bu yanıtta bir kez görünür */
export interface DeviceCreated {
  id: string;
  name: string;
  direction: DeviceDirection;
  token: string;
}

/** Tarama anında geçişin reddedilme nedenleri */
export type EntryDenyReason =
  "INVALID_TOKEN" | "EXPIRED" | "REPLAY" | "NO_ACTIVE_SUBSCRIPTION";

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

// ---- Faz 5: MFA / Doluluk / KVKK ----

/** Hassas işlem (rol atama) MFA doğrulama yöntemi */
export type MfaMethod = "totp" | "otp";

/** Anlık salon doluluğu (US-4) */
export interface OccupancyResponse {
  /** İçerideki üye sayısı (giriş turnikesi sayacı, autoExitHours ile eskiyenler düşülür) */
  inside: number;
  capacity: number | null;
  /** inside/capacity oranı (0-1); kapasite tanımsızsa null */
  ratio: number | null;
}

/** KVKK hesap silme talebi (panel listesi) */
export interface DeletionRequest {
  id: string;
  userId: string;
  email: string;
  name: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
  resolvedAt: string | null;
  resolvedBy: string | null;
}

/** Üyenin kendi silme talebi durumu (mobil) */
export interface MyDeletionRequest {
  status: "none" | "pending" | "rejected";
  requestedAt: string | null;
}

// ---- Faz 6: Hesap Paylaşımı Tespiti / Anti-Debug / Anti-Spoof ----

/** Hesap paylaşımı şüphesi sinyal türleri */
export type SharingSignalKind =
  "fingerprint-churn" | "location-inconsistency" | "mock-location";

/** Hesap paylaşımı tespiti eşik/pencere ayarları (salon ayarlarında düzenlenebilir) */
export interface SharingConfig {
  /** Üye rolü için eşzamanlı oturum üst sınırı */
  memberMaxSessions: number;
  /** Personel/admin rolü için eşzamanlı oturum üst sınırı */
  staffMaxSessions: number;
  /** Bu sayıda sinyal birikince otomatik engelleme tetiklenir */
  signalThreshold: number;
  /** Sinyallerin sayıldığı zaman penceresi (saat) */
  signalWindowHours: number;
  /** Otomatik QR engelinin süresi (saat) */
  qrBlockHours: number;
}
