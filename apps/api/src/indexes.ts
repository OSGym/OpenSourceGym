import { db } from "./db.js";

// Repoda daha önce hiç Mongo indeksi yoktu — bu, ilk indeks bootstrap'ı.
// createIndex çağrıları idempotenttir; her açılışta güvenle tekrar çalıştırılabilir.
export async function ensureIndexes(): Promise<void> {
  // sharing_signals: 30 gün sonra otomatik silinir (TTL) + kullanıcı bazlı sorgu indeksi
  await db
    .collection("sharing_signals")
    .createIndex({ at: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });
  await db.collection("sharing_signals").createIndex({ userId: 1, at: -1 });
  // session: enforceSessionPolicy'nin oturum sayısı/eviction sorguları için
  await db.collection("session").createIndex({ userId: 1 });
}
