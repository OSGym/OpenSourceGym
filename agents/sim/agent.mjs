#!/usr/bin/env node
// OpenGym turnike simülatörü — Node >= 22 (global WebSocket), sıfır bağımlılık.
//
// Kullanım:
//   DEVICE_ID=... DEVICE_TOKEN=og_... node agent.mjs                 # etkileşimli: her satır bir QR taraması
//   DEVICE_ID=... DEVICE_TOKEN=og_... node agent.mjs --scan "<qr>"   # tek atış: tara, sonucu yaz, çık
//
// Ortam değişkenleri:
//   GATEWAY_URL   varsayılan: ws://127.0.0.1:3000/api/device-gateway
//   DEVICE_ID     panelden eklenen cihazın id'si
//   DEVICE_TOKEN  cihaz eklenirken yalnızca bir kez gösterilen "og_" önekli token
//
// Çıkış kodları (--scan modu): 0 = izin verildi, 1 = reddedildi, 2 = hata/bağlantı sorunu

import readline from "node:readline";
import process from "node:process";

const GATEWAY_URL =
  process.env.GATEWAY_URL ?? "ws://127.0.0.1:3000/api/device-gateway";
const DEVICE_ID = process.env.DEVICE_ID;
const DEVICE_TOKEN = process.env.DEVICE_TOKEN;

if (!DEVICE_ID || !DEVICE_TOKEN) {
  console.error("DEVICE_ID ve DEVICE_TOKEN ortam değişkenleri zorunlu.");
  process.exit(2);
}

const scanArgIndex = process.argv.indexOf("--scan");
const oneShotQr = scanArgIndex !== -1 ? process.argv[scanArgIndex + 1] : null;
if (scanArgIndex !== -1 && !oneShotQr) {
  console.error('Kullanım: node agent.mjs --scan "<qr>"');
  process.exit(2);
}

let socket = null;
let authed = false;
let reconnectDelayMs = 1000;
let scanStartedAt = null;

// Tek atış modunda takılı kalmamak için genel zaman aşımı
if (oneShotQr) {
  setTimeout(() => {
    console.error("[zaman aşımı] 10 sn içinde sonuç alınamadı.");
    process.exit(2);
  }, 10_000).unref?.();
}

function connect() {
  const ws = new WebSocket(GATEWAY_URL);
  socket = ws;
  authed = false;

  ws.addEventListener("open", () => {
    ws.send(
      JSON.stringify({ type: "auth", deviceId: DEVICE_ID, token: DEVICE_TOKEN }),
    );
  });

  ws.addEventListener("message", (event) => {
    let msg;
    try {
      msg = JSON.parse(String(event.data));
    } catch {
      return;
    }

    if (msg.type === "auth_ok") {
      authed = true;
      reconnectDelayMs = 1000;
      console.log(`[bağlı] cihaz: ${msg.deviceName}`);
      if (oneShotQr) {
        scanStartedAt = performance.now();
        ws.send(JSON.stringify({ type: "scan", qr: oneShotQr }));
      } else {
        console.log("QR içeriğini yapıştırıp Enter'a basın (Ctrl+C ile çıkış):");
      }
      return;
    }

    if (msg.type === "auth_error") {
      // Token yanlışsa yeniden denemenin anlamı yok — çık.
      console.error(`[kimlik hatası] ${msg.message}`);
      process.exit(2);
    }

    if (msg.type === "scan_result") {
      const ms =
        scanStartedAt !== null
          ? (performance.now() - scanStartedAt).toFixed(0)
          : "?";
      scanStartedAt = null;
      if (msg.allow) {
        console.log(
          `AÇIK  üye: ${msg.memberName ?? "?"}  (${ms} ms) — röle ${msg.openMs ?? 500} ms tetiklendi`,
        );
        if (oneShotQr) process.exit(0);
      } else {
        console.log(
          `RED   neden: ${msg.reason ?? "?"}  (${ms} ms) — röle kapalı (fail-closed)`,
        );
        if (oneShotQr) process.exit(1);
      }
    }
  });

  ws.addEventListener("close", () => {
    authed = false;
    if (oneShotQr) {
      console.error("[koptu] sonuç alınamadan bağlantı kapandı.");
      process.exit(2);
    }
    console.log(
      `[koptu] ${Math.round(reconnectDelayMs / 1000)} sn sonra yeniden bağlanılacak...`,
    );
    setTimeout(connect, reconnectDelayMs);
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, 30_000);
  });

  // "error" sonrasında her zaman "close" gelir; yeniden bağlanmayı close yönetir.
  ws.addEventListener("error", () => {});
}

connect();

if (!oneShotQr) {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    const qr = line.trim();
    if (!qr) return;
    if (!socket || socket.readyState !== WebSocket.OPEN || !authed) {
      console.log("RED   sunucu bağlı değil (fail-closed)");
      return;
    }
    scanStartedAt = performance.now();
    socket.send(JSON.stringify({ type: "scan", qr }));
  });
}
