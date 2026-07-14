import assert from "node:assert/strict";
import test from "node:test";
import { ObjectId } from "mongodb";
import { gateQrContent, verifyGateQr } from "./gateQr.js";

test("üretilen statik QR içeriği doğrulanır ve deviceId geri döner", () => {
  const deviceId = new ObjectId().toString();
  const content = gateQrContent(deviceId);
  const result = verifyGateQr(content);
  assert.deepEqual(result, { ok: true, deviceId });
});

test("aynı cihaz için QR içeriği deterministiktir (statik, süresiz)", () => {
  const deviceId = new ObjectId().toString();
  assert.equal(gateQrContent(deviceId), gateQrContent(deviceId));
});

test("imzası bozulmuş QR reddedilir", () => {
  const deviceId = new ObjectId().toString();
  const [prefix, id] = gateQrContent(deviceId).split(".");
  const tampered = `${prefix}.${id}.deadbeef`;
  assert.deepEqual(verifyGateQr(tampered), { ok: false });
});

test("yanlış öneke sahip içerik reddedilir", () => {
  const deviceId = new ObjectId().toString();
  const content = gateQrContent(deviceId).replace("OGGATE1", "OG1");
  assert.deepEqual(verifyGateQr(content), { ok: false });
});

test("geçersiz ObjectId taşıyan içerik reddedilir", () => {
  assert.deepEqual(verifyGateQr("OGGATE1.not-an-object-id.sig"), {
    ok: false,
  });
});

test("başka bir cihazın imzası bu cihaz için geçersizdir", () => {
  const deviceA = new ObjectId().toString();
  const deviceB = new ObjectId().toString();
  const [prefix, , sigA] = gateQrContent(deviceA).split(".");
  const forged = `${prefix}.${deviceB}.${sigA}`;
  assert.deepEqual(verifyGateQr(forged), { ok: false });
});
