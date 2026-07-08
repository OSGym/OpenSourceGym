import { ObjectId } from "mongodb";
import { db } from "./db.js";

// Kullanıcının şu an aktif (başlangıç <= şimdi <= bitiş) bir aboneliği var mı
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const now = new Date();
  const doc = await db.collection("subscriptions").findOne({
    userId: new ObjectId(userId),
    startsAt: { $lte: now },
    endsAt: { $gte: now },
  });
  return doc !== null;
}
