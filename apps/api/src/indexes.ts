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
// indeks düşürülüp yenisi kurulur. dropIndex isim ister; buradaki indeksler
// hep bu bootstrap'la, özel isim verilmeden kurulduğundan Mongo'nun varsayılan
// adlandırması ("alan_yön" birleşimi) güvenle türetilebilir.
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
      const defaultName = Object.entries(keys)
        .map(([field, dir]) => `${field}_${String(dir)}`)
        .join("_");
      await database.collection(collection).dropIndex(defaultName);
      await database.collection(collection).createIndex(keys, options);
      return;
    }
    throw err;
  }
}

// Repoda daha önce hiç Mongo indeksi yoktu — bu, ilk indeks bootstrap'ı.
export async function ensureIndexes(): Promise<void> {
  // sharing_signals: 30 gün sonra otomatik silinir (TTL) + kullanıcı bazlı sorgu indeksi
  await ensureIndex(
    db,
    "sharing_signals",
    { at: 1 },
    { expireAfterSeconds: 30 * 24 * 3600 },
  );
  await ensureIndex(db, "sharing_signals", { userId: 1, at: -1 });
  // session: enforceSessionPolicy'nin oturum sayısı/eviction sorguları için
  await ensureIndex(db, "session", { userId: 1 });
}
