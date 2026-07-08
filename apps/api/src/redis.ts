import { createClient } from "redis";
import { env } from "./env.js";

export const redis = createClient({ url: env.redisUrl });

redis.on("error", (err) => {
  console.error("redis error:", err);
});

export async function connectRedis(): Promise<void> {
  if (!redis.isOpen) {
    await redis.connect();
  }
}
