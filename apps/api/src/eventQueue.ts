import type { GateRejectCode } from "@opengym/shared";
import { db } from "./db.js";
import { redis } from "./redis.js";

const QUEUE_KEY = "og:entry-events";

export interface EntryEventInput {
  deviceId: string;
  deviceName: string;
  userId: string | null;
  memberName: string | null;
  allowed: boolean;
  reason: GateRejectCode | null;
  at: Date;
}

// Turnike geçiş olayını Redis kuyruğuna iter (fire-and-forget) — API yanıtını bekletmez
export function enqueueEntryEvent(ev: EntryEventInput): void {
  const serialized = JSON.stringify({ ...ev, at: ev.at.toISOString() });
  redis.lPush(QUEUE_KEY, serialized).catch(console.error);
}

// Kuyruktaki geçiş olaylarını arka planda tüketip entry_events koleksiyonuna yazar
export async function startEntryEventConsumer(): Promise<void> {
  const consumer = redis.duplicate();
  await consumer.connect();

  void (async () => {
    for (;;) {
      const result = await consumer.brPop(QUEUE_KEY, 5);
      if (!result) {
        continue;
      }
      const raw = result.element;

      let parsed: (EntryEventInput & { at: string }) | null = null;
      try {
        parsed = JSON.parse(raw) as EntryEventInput & { at: string };
      } catch (err) {
        // raw loglanmaz: içerik üye kimlik bilgisi (PII) taşıyabilir
        console.error("çözümlenemeyen entry event, atlanıyor:", err);
        continue;
      }

      try {
        await db.collection("entry_events").insertOne({
          ...parsed,
          at: new Date(parsed.at),
        });
      } catch (err) {
        console.error("entry event yazılamadı, kuyruğa geri konuyor:", err);
        await redis.lPush(QUEUE_KEY, raw).catch(console.error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  })();
}
