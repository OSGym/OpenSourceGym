import type { Server } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { performance } from "node:perf_hooks";
import { ObjectId } from "mongodb";
import { WebSocket, WebSocketServer } from "ws";
import type {
  DeviceClientMessage,
  DeviceServerMessage,
  EntryDenyReason,
} from "@opengym/shared";
import { db } from "./db.js";
import { redis } from "./redis.js";
import { QR_TOKEN_TTL_SECONDS, verifyQrToken } from "./qr.js";
import { hasActiveSubscription } from "./subscriptions.js";
import { enqueueEntryEvent } from "./eventQueue.js";

const GATEWAY_PATH = "/api/device-gateway";
const AUTH_TIMEOUT_MS = 5000;
const PING_INTERVAL_MS = 30_000;

interface DeviceSocket extends WebSocket {
  deviceId?: string;
  deviceName?: string;
  isAlive?: boolean;
}

// Kimliği doğrulanmış turnike cihazı bağlantıları — deviceId -> soket
const devices = new Map<string, DeviceSocket>();

function send(ws: WebSocket, msg: DeviceServerMessage): void {
  ws.send(JSON.stringify(msg));
}

function touchLastSeen(deviceId: string): void {
  db.collection("devices")
    .updateOne(
      { _id: new ObjectId(deviceId) },
      { $set: { lastSeenAt: new Date() } },
    )
    .catch(console.error);
}

// Aynı cihaz kimliğiyle yeni bir bağlantı geldiğinde eskisini kapatıp yenisini kaydeder
function registerDevice(id: string, ws: DeviceSocket): void {
  const existing = devices.get(id);
  if (existing && existing !== ws) {
    existing.close(4000, "yeni bağlantı");
  }
  devices.set(id, ws);
}

// Registry'den yalnızca hâlâ aynı soketi işaret ediyorsa siler (yer değiştirmiş bağlantıyı bozmaz)
function unregisterDevice(id: string, ws: DeviceSocket): void {
  if (devices.get(id) === ws) {
    devices.delete(id);
  }
}

export function isAnyDeviceOnline(): boolean {
  return devices.size > 0;
}

export function isDeviceOnline(id: string): boolean {
  return devices.has(id);
}

export function disconnectDevice(id: string): void {
  const ws = devices.get(id);
  if (ws) {
    ws.close(4001, "cihaz kaldırıldı");
    devices.delete(id);
  }
}

// Kimlik doğrulama başarısızlığı: sebep ne olursa olsun (kötü mesaj, bilinmeyen
// cihaz, yanlış token, zaman aşımı) istemciye aynı mesaj gönderilip bağlantı kapatılır
function failAuth(ws: WebSocket): void {
  send(ws, {
    type: "auth_error",
    message: "Cihaz kimlik doğrulaması başarısız.",
  });
  ws.close();
}

function isAuthMessage(
  msg: unknown,
): msg is Extract<DeviceClientMessage, { type: "auth" }> {
  return (
    typeof msg === "object" &&
    msg !== null &&
    (msg as { type?: unknown }).type === "auth" &&
    typeof (msg as { deviceId?: unknown }).deviceId === "string" &&
    typeof (msg as { token?: unknown }).token === "string"
  );
}

async function authenticate(
  ws: DeviceSocket,
  raw: WebSocket.RawData,
): Promise<void> {
  try {
    const msg: unknown = JSON.parse(raw.toString());
    if (!isAuthMessage(msg) || !ObjectId.isValid(msg.deviceId)) {
      throw new Error("geçersiz kimlik doğrulama mesajı");
    }
    const device = await db
      .collection("devices")
      .findOne({ _id: new ObjectId(msg.deviceId) });
    if (!device) {
      throw new Error("bilinmeyen cihaz");
    }
    const tokenHash = createHash("sha256").update(msg.token).digest();
    const storedHash = Buffer.from(String(device.tokenHash), "hex");
    if (
      tokenHash.length !== storedHash.length ||
      !timingSafeEqual(tokenHash, storedHash)
    ) {
      throw new Error("geçersiz token");
    }

    ws.deviceId = msg.deviceId;
    ws.deviceName = device.name as string;
    ws.isAlive = true;
    registerDevice(msg.deviceId, ws);
    send(ws, { type: "auth_ok", deviceName: ws.deviceName });
    touchLastSeen(msg.deviceId);
    ws.on("message", (data) => {
      handleScan(ws, data).catch((err) => {
        console.error("tarama işlenirken hata:", err);
      });
    });
  } catch (err) {
    console.warn("cihaz kimlik doğrulaması başarısız:", err);
    failAuth(ws);
  }
}

function isScanMessage(
  msg: unknown,
): msg is Extract<DeviceClientMessage, { type: "scan" }> {
  return (
    typeof msg === "object" &&
    msg !== null &&
    (msg as { type?: unknown }).type === "scan" &&
    typeof (msg as { qr?: unknown }).qr === "string"
  );
}

// Kimliği doğrulanmış cihazdan gelen QR tarama isteğini işler (KPI-1: uçtan uca süre ölçümü)
async function handleScan(
  ws: DeviceSocket,
  raw: WebSocket.RawData,
): Promise<void> {
  let msg: unknown;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    console.warn("cihazdan çözümlenemeyen mesaj alındı");
    return;
  }
  if (!isScanMessage(msg)) {
    console.warn("cihazdan bilinmeyen mesaj tipi alındı:", msg);
    return;
  }

  const start = performance.now();
  const deviceId = ws.deviceId ?? "";
  const deviceName = ws.deviceName ?? "";

  function deny(
    reason: EntryDenyReason,
    userId: string | null,
    memberName: string | null,
    jti: string | null,
  ): void {
    send(ws, { type: "scan_result", allow: false, reason });
    enqueueEntryEvent({
      deviceId,
      deviceName,
      userId,
      memberName,
      allowed: false,
      reason,
      jti,
      at: new Date(),
    });
  }

  try {
    const verified = verifyQrToken(msg.qr);
    if (!verified.ok) {
      deny(verified.reason, null, null, null);
      return;
    }
    const { userId, jti } = verified;

    // Tekrar oynatma (replay) koruması: bir jti yalnızca bir kez kullanılabilir
    const replaySet = await redis.set(`og:qr-used:${jti}`, "1", {
      NX: true,
      EX: QR_TOKEN_TTL_SECONDS + 30,
    });
    if (replaySet === null) {
      deny("REPLAY", userId, null, jti);
      return;
    }

    if (!ObjectId.isValid(userId)) {
      deny("INVALID_TOKEN", userId, null, jti);
      return;
    }
    const user = await db
      .collection("user")
      .findOne({ _id: new ObjectId(userId) });
    if (!user) {
      deny("INVALID_TOKEN", userId, null, jti);
      return;
    }

    if (!(await hasActiveSubscription(userId))) {
      deny(
        "NO_ACTIVE_SUBSCRIPTION",
        userId,
        (user.name as string) ?? null,
        jti,
      );
      return;
    }

    const memberName = (user.name as string) ?? "";
    send(ws, {
      type: "scan_result",
      allow: true,
      memberName,
      openMs: 500,
    });
    enqueueEntryEvent({
      deviceId,
      deviceName,
      userId,
      memberName,
      allowed: true,
      reason: null,
      jti,
      at: new Date(),
    });
  } finally {
    const ms = performance.now() - start;
    console.log(`[gateway] scan işlendi (${deviceName}): ${ms.toFixed(1)}ms`);
  }
}

export function attachDeviceGateway(server: Server): void {
  // maxPayload: cihaz mesajları (auth/scan) 1 KB altındadır; büyük frame'lerle
  // kimlik doğrulaması öncesi bellek tüketimini engeller
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 });

  server.on("upgrade", (req, socket, head) => {
    const pathname = new URL(req.url ?? "", "http://localhost").pathname;
    if (pathname !== GATEWAY_PATH) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  const pingInterval = setInterval(() => {
    for (const [id, ws] of devices) {
      if (ws.isAlive === false) {
        ws.terminate();
        unregisterDevice(id, ws);
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, PING_INTERVAL_MS);

  wss.on("close", () => {
    clearInterval(pingInterval);
  });

  wss.on("connection", (ws: DeviceSocket) => {
    let authenticated = false;

    // error dinleyicisi zorunlu: dinleyicisiz "error" event'i süreci çökertir
    // (ör. maxPayload aşımı, protokol ihlali, ECONNRESET) — ws bağlantıyı kendisi kapatır
    ws.on("error", (err) => {
      console.warn("cihaz soketi hatası:", err.message);
    });

    const authTimer = setTimeout(() => {
      if (!authenticated) {
        failAuth(ws);
      }
    }, AUTH_TIMEOUT_MS);

    ws.once("message", (raw) => {
      clearTimeout(authTimer);
      authenticate(ws, raw)
        .then(() => {
          authenticated = ws.deviceId !== undefined;
        })
        .catch((err) => {
          console.error("kimlik doğrulama hatası:", err);
        });
    });

    ws.on("pong", () => {
      ws.isAlive = true;
      if (ws.deviceId) {
        touchLastSeen(ws.deviceId);
      }
    });

    ws.on("close", () => {
      clearTimeout(authTimer);
      if (ws.deviceId) {
        unregisterDevice(ws.deviceId, ws);
      }
    });
  });
}
