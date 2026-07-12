import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const redisUri = process.env.TEST_REDIS_URL;

test(
  "profil fotoğrafı yükleme limiti pencere aşımında 429 hatasına dönüşür",
  { skip: redisUri ? false : "TEST_REDIS_URL tanımlı değil" },
  async () => {
    // profilePhoto modülünün paylaşılan Redis istemcisi import anında
    // oluşur; test adresini dinamik importtan önce yerleştiririz.
    process.env.REDIS_URL = redisUri!;
    const [
      { enforceProfilePhotoRateLimit, ProfilePhotoRateLimitError },
      { redis },
    ] = await Promise.all([
      import("../profilePhoto.js"),
      import("../redis.js"),
    ]);

    const userId = `test-${randomUUID()}`;
    const key = `og:rl:profile-photo:${userId}`;
    try {
      await redis.connect();
      for (let i = 0; i < 10; i++) {
        await enforceProfilePhotoRateLimit(userId);
      }
      await assert.rejects(
        () => enforceProfilePhotoRateLimit(userId),
        ProfilePhotoRateLimitError,
      );
      const ttl = await redis.ttl(key);
      assert.ok(ttl > 0 && ttl <= 3600, `TTL pencere içinde olmalı: ${ttl}`);
    } finally {
      await redis.del(key).catch(() => {});
      await redis.quit().catch(() => {});
    }
  },
);
