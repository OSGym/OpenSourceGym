import {
  MongoServerError,
  type Db,
  type CreateIndexesOptions,
  type IndexDirection,
} from "mongodb";
import { db } from "./db.js";

// createIndex aynı anahtar + aynı seçeneklerle idempotenttir; ancak seçenekler
// DEĞİŞİRSE (ör. TTL süresi güncellenirse) Mongo IndexOptionsConflict (85) /
// IndexKeySpecsConflict (86) fırlatır ve API açılışta çökerdi. Bu durumda eski
// indeks düşürülüp yenisi kurulur. dropIndex isim ister; özel isim (options.name)
// verilmişse o kullanılır, verilmemişse Mongo'nun varsayılan adlandırması
// ("alan_yön" birleşimi) güvenle türetilebilir.
async function ensureIndex(
  database: Db,
  collection: string,
  keys: Record<string, IndexDirection>,
  options?: CreateIndexesOptions,
): Promise<void> {
  try {
    await database.collection(collection).createIndex(keys, options);
  } catch (err) {
    if (
      err instanceof MongoServerError &&
      (err.code === 85 || err.code === 86)
    ) {
      const indexName =
        options?.name ??
        Object.entries(keys)
          .map(([field, dir]) => `${field}_${String(dir)}`)
          .join("_");
      await database.collection(collection).dropIndex(indexName);
      await database.collection(collection).createIndex(keys, options);
      return;
    }
    throw err;
  }
}

// Repoda daha önce hiç Mongo indeksi yoktu — bu, ilk indeks bootstrap'ı.
// ensureIndex idempotenttir ve seçenek çakışmasında düşürüp yeniden kurar;
// her açılışta güvenle tekrar çalıştırılabilir.
export async function ensureIndexes(database: Db = db): Promise<void> {
  // phoneE164 yalnızca doğrulanıp tekilleştirilen belgelerde bulunur. Eski
  // mükerrer belgeler alanı taşımadığı için kısmi indeks onları koruyarak yeni
  // yarış koşullarını atomik biçimde engeller.
  await ensureIndex(
    database,
    "user",
    { phoneE164: 1 },
    {
      name: "user_phone_e164_unique",
      unique: true,
      partialFilterExpression: { phoneE164: { $type: "string" } },
    },
  );

  // Abonelik ekleme, QR kontrolü ve admin zaman çizelgesi kullanıcı bazında
  // en geç bitişi sıkça okur.
  await ensureIndex(
    database,
    "subscriptions",
    { userId: 1, endsAt: -1 },
    { name: "subscriptions_user_ends_at" },
  );

  // sharing_signals: 30 gün sonra otomatik silinir (TTL) + kullanıcı bazlı sorgu indeksi
  await ensureIndex(
    database,
    "sharing_signals",
    { at: 1 },
    { expireAfterSeconds: 30 * 24 * 3600 },
  );
  await ensureIndex(database, "sharing_signals", { userId: 1, at: -1 });
  // session: enforceSessionPolicy'nin oturum sayısı/eviction sorguları için
  await ensureIndex(database, "session", { userId: 1 });
}
