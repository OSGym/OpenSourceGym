import { db } from "./db.js";
import type { SessionUser } from "./middleware.js";

export async function logAudit(
  actor: SessionUser,
  action: string,
  targetId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  await db.collection("audit_logs").insertOne({
    actorId: actor.id,
    actorEmail: actor.email,
    action,
    targetId: targetId ?? null,
    details: details ?? null,
    at: new Date(),
  });
}
