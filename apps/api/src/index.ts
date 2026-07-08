import express from "express";
import { toNodeHandler } from "better-auth/node";
import type { HealthResponse } from "@opengym/shared";
import { env } from "./env.js";
import { connectRedis } from "./redis.js";
import { mongoClient } from "./db.js";
import { auth } from "./auth.js";
import { seedInitialAdmin } from "./seed.js";
import { adminRouter } from "./routes/admin.js";
import { meRouter } from "./routes/me.js";

const app = express();

// BetterAuth kendi body parsing'ini yapar; express.json()'dan ÖNCE mount edilmeli
app.all("/api/auth/{*splat}", toNodeHandler(auth));

app.use(express.json());

app.use("/api/admin", adminRouter);
app.use("/api/me", meRouter);

app.get("/health", (_req, res) => {
  const body: HealthResponse = {
    status: "ok",
    service: "opengym-api",
    timestamp: new Date().toISOString(),
  };
  res.json(body);
});

async function main() {
  await mongoClient.connect();
  await connectRedis();
  await seedInitialAdmin();
  app.listen(env.port, () => {
    console.log(`opengym-api listening on :${env.port}`);
  });
}

main().catch((err) => {
  console.error("startup failed:", err);
  process.exit(1);
});
