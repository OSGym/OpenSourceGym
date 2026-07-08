import { db } from "./db.js";

const COLLECTION = "device_status_log";
const WINDOW_MS = 24 * 60 * 60 * 1000;

interface DeviceStatusLogDoc {
  deviceId: string;
  online: boolean;
  at: Date;
}

// Cihaz bağlantı durumu geçmişi (KPI-4: son 24 saat çevrimiçi kalma yüzdesi).
// Fire-and-forget: API/Gateway akışını bloklamaz, hata konsola düşer.
export function logDeviceStatus(deviceId: string, online: boolean): void {
  db.collection<DeviceStatusLogDoc>(COLLECTION)
    .insertOne({ deviceId, online, at: new Date() })
    .catch((err) => {
      console.error("cihaz durum kaydı yazılamadı:", err);
    });
}

// Sunucu çöktükten/yeniden başladıktan sonra "online: true" olarak kalmış
// cihazlar için kurtarma: her cihazın en son kaydı online ise bir "false"
// kaydı eklenir (aksi halde uptime hesaplaması cihazı sonsuza dek çevrimiçi sanır)
export function sweepStaleOnlineStatus(): void {
  (async () => {
    const collection = db.collection<DeviceStatusLogDoc>(COLLECTION);
    const deviceIds = await collection.distinct("deviceId");
    for (const deviceId of deviceIds) {
      const latest = await collection
        .find({ deviceId })
        .sort({ at: -1 })
        .limit(1)
        .next();
      if (latest?.online === true) {
        await collection.insertOne({ deviceId, online: false, at: new Date() });
      }
    }
  })().catch((err) => {
    console.error("cihaz durum geçmişi başlangıç taraması başarısız:", err);
  });
}

// Son 24 saatte cihazın çevrimiçi kaldığı süre yüzdesi (0-100, 1 ondalık basamak)
export async function computeUptime24h(
  deviceId: string,
  nowOnline: boolean,
): Promise<number> {
  const now = Date.now();
  const windowStart = new Date(now - WINDOW_MS);
  const collection = db.collection<DeviceStatusLogDoc>(COLLECTION);

  const inWindow = await collection
    .find({ deviceId, at: { $gte: windowStart } })
    .sort({ at: 1 })
    .toArray();
  const before = await collection
    .find({ deviceId, at: { $lt: windowStart } })
    .sort({ at: -1 })
    .limit(1)
    .next();

  if (inWindow.length === 0) {
    if (!before) {
      // Hiç kayıt yok: cihazın şu anki durumu pencere boyunca sabit kabul edilir
      return nowOnline ? 100 : 0;
    }
    return before.online ? 100 : 0;
  }

  const firstInWindow = inWindow[0]!;
  // Pencere başındaki durum: öncesinde bir kayıt varsa o durum, yoksa
  // penceredeki ilk kaydın kendisi bir durum DEĞİŞİKLİĞİ olduğundan öncesinin
  // tersi olduğu varsayılır
  let state = before ? before.online : !firstInWindow.online;
  let cursor = windowStart.getTime();
  let onlineMs = 0;

  for (const log of inWindow) {
    const t = log.at.getTime();
    if (state) {
      onlineMs += t - cursor;
    }
    state = log.online;
    cursor = t;
  }
  // Son segment: son kayıttan şimdiye kadar geçen süre
  if (state) {
    onlineMs += now - cursor;
  }

  const pct = (onlineMs / WINDOW_MS) * 100;
  return Math.round(pct * 10) / 10;
}
