import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import type { Device, DeviceCreated } from "@opengym/shared";
import { db } from "../db.js";
import { logAudit } from "../audit.js";
import { requireRole } from "../middleware.js";
import { disconnectDevice, isDeviceOnline } from "../gateway.js";

export const devicesRouter: Router = Router();

const createDeviceSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

function parseObjectId(value: string): ObjectId | null {
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

// Turnike cihazı kaydı — token yalnızca bu yanıtta bir kez görünür, sunucuda hash'i saklanır
devicesRouter.post("/", requireRole("admin"), async (req, res) => {
  const parsed = createDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Geçersiz cihaz adı." });
    return;
  }
  const { name } = parsed.data;
  const token = `og_${randomBytes(24).toString("hex")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const inserted = await db.collection("devices").insertOne({
    name,
    tokenHash,
    createdAt: new Date(),
    createdBy: req.user!.id,
    lastSeenAt: null,
  });
  await logAudit(req.user!, "device-created", inserted.insertedId.toString(), {
    name,
  });

  const body: DeviceCreated = {
    id: inserted.insertedId.toString(),
    name,
    token,
  };
  res.json(body);
});

// Cihaz listesi — anlık bağlantı durumu Device Gateway registry'sinden okunur
devicesRouter.get("/", requireRole("admin", "staff"), async (_req, res) => {
  const docs = await db
    .collection("devices")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
  const body: Device[] = docs.map((d) => {
    const id = d._id.toString();
    return {
      id,
      name: d.name,
      online: isDeviceOnline(id),
      lastSeenAt: d.lastSeenAt ? new Date(d.lastSeenAt).toISOString() : null,
      createdAt: d.createdAt.toISOString(),
    };
  });
  res.json(body);
});

// Cihaz silme — kayıtlı bağlantı varsa Gateway'den de düşürülür
devicesRouter.delete("/:id", requireRole("admin"), async (req, res) => {
  const targetId = parseObjectId(String(req.params.id ?? ""));
  if (!targetId) {
    res.status(404).json({ message: "Cihaz bulunamadı." });
    return;
  }
  const result = await db.collection("devices").deleteOne({ _id: targetId });
  if (result.deletedCount === 0) {
    res.status(404).json({ message: "Cihaz bulunamadı." });
    return;
  }
  disconnectDevice(targetId.toString());
  await logAudit(req.user!, "device-deleted", targetId.toString());
  res.json({ ok: true });
});
