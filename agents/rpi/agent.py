#!/usr/bin/env python3
# OpenGym turnike ajanı — Raspberry Pi referans uygulaması.
#
# Gereksinimler:
#   pip install websockets gpiozero
#
# Donanım varsayımı:
#   - USB QR okuyucu, HID klavye modunda: okunan kod satır olarak stdin'e düşer.
#   - Röle modülü GPIO pinine bağlı (varsayılan BCM 17), turnike tetik girişini sürer.
#
# Ortam değişkenleri:
#   GATEWAY_URL   varsayılan: ws://127.0.0.1:3000/api/device-gateway
#   DEVICE_ID     panelden eklenen cihazın id'si
#   DEVICE_TOKEN  cihaz eklenirken yalnızca bir kez gösterilen "og_" önekli token
#   RELAY_GPIO    varsayılan: 17 (BCM)
#
# Fail-closed: röle varsayılan olarak KAPALI; yalnızca sunucudan allow geldiğinde
# openMs süresince açılır. Bağlantı yokken hiçbir tarama kapı açmaz.

import asyncio
import json
import os
import sys
import threading

try:
    import websockets
except ImportError:
    sys.exit("websockets paketi gerekli: pip install websockets")

GATEWAY_URL = os.environ.get("GATEWAY_URL", "ws://127.0.0.1:3000/api/device-gateway")
DEVICE_ID = os.environ.get("DEVICE_ID")
DEVICE_TOKEN = os.environ.get("DEVICE_TOKEN")
RELAY_GPIO = int(os.environ.get("RELAY_GPIO", "17"))

if not DEVICE_ID or not DEVICE_TOKEN:
    sys.exit("DEVICE_ID ve DEVICE_TOKEN ortam değişkenleri zorunlu.")


class DummyRelay:
    """GPIO olmayan ortamda (geliştirme makinesi) simülasyon."""

    def on(self):
        print("[röle] AÇIK (simülasyon)")

    def off(self):
        print("[röle] KAPALI (simülasyon)")


try:
    from gpiozero import OutputDevice

    # initial_value=False → açılışta röle kapalı (fail-closed)
    relay = OutputDevice(RELAY_GPIO, active_high=True, initial_value=False)
except Exception:
    relay = DummyRelay()


async def pulse_relay(open_ms: int) -> None:
    # Röle yalnızca süreli açılır; her durumda finally ile kapanır.
    relay.on()
    try:
        await asyncio.sleep(open_ms / 1000)
    finally:
        relay.off()


def start_stdin_reader(loop: asyncio.AbstractEventLoop, queue: asyncio.Queue) -> None:
    # QR okuyucu HID klavye gibi davranır: her okuma stdin'e bir satır yazar.
    def reader():
        for line in sys.stdin:
            qr = line.strip()
            if qr:
                loop.call_soon_threadsafe(queue.put_nowait, qr)

    threading.Thread(target=reader, daemon=True).start()


async def pump_scans(ws, queue: asyncio.Queue) -> None:
    while True:
        qr = await queue.get()
        await ws.send(json.dumps({"type": "scan", "qr": qr}))


async def handle_messages(ws) -> None:
    async for raw in ws:
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if msg.get("type") == "scan_result":
            if msg.get("allow"):
                print(f"AÇIK  üye: {msg.get('memberName', '?')}")
                asyncio.create_task(pulse_relay(int(msg.get("openMs", 500))))
            else:
                print(f"RED   neden: {msg.get('reason', '?')} — röle kapalı (fail-closed)")


async def run() -> None:
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    start_stdin_reader(loop, queue)

    delay = 1
    while True:
        try:
            # websockets kütüphanesi sunucu ping'lerini otomatik yanıtlar (keepalive).
            async with websockets.connect(GATEWAY_URL) as ws:
                await ws.send(
                    json.dumps(
                        {"type": "auth", "deviceId": DEVICE_ID, "token": DEVICE_TOKEN}
                    )
                )
                first = json.loads(await ws.recv())
                if first.get("type") != "auth_ok":
                    # Token yanlışsa yeniden denemenin anlamı yok — çık.
                    sys.exit(f"[kimlik hatası] {first.get('message', '?')}")
                print(f"[bağlı] cihaz: {first.get('deviceName')}")
                delay = 1

                pump = asyncio.create_task(pump_scans(ws, queue))
                try:
                    await handle_messages(ws)  # bağlantı kopunca döner
                finally:
                    pump.cancel()
        except (OSError, websockets.WebSocketException) as exc:
            print(f"[koptu] {exc} — {delay} sn sonra yeniden bağlanılacak...")

        await asyncio.sleep(delay)
        delay = min(delay * 2, 30)


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass
    finally:
        relay.off()  # her çıkışta fail-closed
