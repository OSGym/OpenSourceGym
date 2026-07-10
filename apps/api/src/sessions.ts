import { ObjectId } from "mongodb";
import { db } from "./db.js";
import { redis } from "./redis.js";

// Bir kullanıcının TÜM oturumlarını iptal eder: Redis'te önbelleğe alınmış
// BetterAuth oturumları (secondary storage, anahtar = oturum token'ı) TTL
// beklemeden açıkça silinir, ardından Mongo'daki oturum kayıtları temizlenir.
// Uygulama rotaları zaten middleware'in Mongo re-read'iyle 401'e düşer.
export async function revokeUserSessions(userId: string): Promise<number> {
  const targetId = new ObjectId(userId);
  const sessionDocs = await db
    .collection("session")
    .find({ userId: targetId })
    .project({ token: 1 })
    .toArray();
  const sessionTokens = sessionDocs
    .map((s) => String(s.token ?? ""))
    .filter(Boolean);
  if (sessionTokens.length > 0) {
    await redis.del(sessionTokens).catch(console.error);
  }
  await redis.del(`active-sessions-${userId}`).catch(console.error);

  const result = await db.collection("session").deleteMany({ userId: targetId });
  return result.deletedCount;
}
