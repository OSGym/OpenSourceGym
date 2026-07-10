import { createServer } from "node:http";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import type { HealthResponse } from "@opengym/shared";
import { env } from "./env.js";
import { connectRedis } from "./redis.js";
import { mongoClient } from "./db.js";
import { auth } from "./auth.js";
import { seedInitialAdmin } from "./seed.js";
import { ensureIndexes } from "./indexes.js";
import { adminRouter } from "./routes/admin.js";
import { meRouter } from "./routes/me.js";
import { devicesRouter } from "./routes/devices.js";
import { attachDeviceGateway } from "./gateway.js";
import { startEntryEventConsumer } from "./eventQueue.js";

const app = express();

// BetterAuth kendi body parsing'ini yapar; express.json()'dan ÖNCE mount edilmeli
app.all("/api/auth/{*splat}", toNodeHandler(auth));

app.use(express.json());

app.use("/api/admin/devices", devicesRouter);
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

const server = createServer(app);

async function main() {
  await mongoClient.connect();
  await ensureIndexes();
  await connectRedis();
  await seedInitialAdmin();
  attachDeviceGateway(server);
  await startEntryEventConsumer();
  server.listen(env.port, () => {
    console.log(`opengym-api listening on :${env.port}`);
  });
}

main().catch((err) => {
  console.error("startup failed:", err);
  process.exit(1);
});
