import type { Db } from "mongodb";
import { db } from "./db.js";

// Repoda daha önce hiç Mongo indeksi yoktu — bu, ilk indeks bootstrap'ı.
// createIndex çağrıları idempotenttir; her açılışta güvenle tekrar çalıştırılabilir.
export async function ensureIndexes(database: Db = db): Promise<void> {
  // phoneE164 yalnızca doğrulanıp tekilleştirilen belgelerde bulunur. Eski
  // mükerrer belgeler alanı taşımadığı için kısmi indeks onları koruyarak yeni
  // yarış koşullarını atomik biçimde engeller.
  await database.collection("user").createIndex(
    { phoneE164: 1 },
    {
      name: "user_phone_e164_unique",
      unique: true,
      partialFilterExpression: { phoneE164: { $type: "string" } },
    },
  );

  // Abonelik ekleme, QR kontrolü ve admin zaman çizelgesi kullanıcı bazında
  // en geç bitişi sıkça okur.
  await database
    .collection("subscriptions")
    .createIndex(
      { userId: 1, endsAt: -1 },
      { name: "subscriptions_user_ends_at" },
    );

  // sharing_signals: 30 gün sonra otomatik silinir (TTL) + kullanıcı bazlı sorgu indeksi
  await database
    .collection("sharing_signals")
    .createIndex({ at: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });
  await database
    .collection("sharing_signals")
    .createIndex({ userId: 1, at: -1 });
  // session: enforceSessionPolicy'nin oturum sayısı/eviction sorguları için
  await database.collection("session").createIndex({ userId: 1 });
}
