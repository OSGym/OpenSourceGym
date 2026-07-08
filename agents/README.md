# Turnike Cihaz Ajanları

Faz 4 Device Gateway'e bağlanan cihaz tarafı referans uygulamaları. Bu dizin pnpm workspace'in **dışındadır**; kod doğrudan cihaza kopyalanır.

| Ajan | Platform | Ne için |
|---|---|---|
| `sim/agent.mjs` | Node ≥ 22 (bağımlılık yok) | Geliştirme/test simülatörü |
| `rpi/agent.py` | Raspberry Pi (Python 3) | USB QR okuyucu + GPIO röle |
| `esp32/agent.ino` | ESP32 (Arduino) | UART QR modülü + röle |

## Protokol

WebSocket, JSON text frame, endpoint: `ws://<api-host>:3000/api/device-gateway`
(tipler: `packages/shared` → `DeviceClientMessage` / `DeviceServerMessage`)

1. Bağlantı açılır açılmaz cihaz kimlik doğrular (ilk mesaj, 5 sn içinde):
   ```json
   { "type": "auth", "deviceId": "<panel'deki cihaz id>", "token": "og_..." }
   ```
   Yanıt: `{"type":"auth_ok","deviceName":"..."}` veya `{"type":"auth_error","message":"..."}` + bağlantı kapanır.
2. Her QR okumada cihaz gönderir:
   ```json
   { "type": "scan", "qr": "<QR içeriği: OG1.xxx.yyy>" }
   ```
   Yanıt:
   ```json
   { "type": "scan_result", "allow": true,  "memberName": "...", "openMs": 500 }
   { "type": "scan_result", "allow": false, "reason": "EXPIRED" }
   ```
   Red nedenleri: `INVALID_TOKEN`, `EXPIRED`, `REPLAY`, `NO_ACTIVE_SUBSCRIPTION`.
3. Sunucu 30 sn'de bir WebSocket ping atar; kullanılan istemci kütüphaneleri otomatik pong yanıtlar. Pong gelmeyen bağlantı sunucu tarafında kapatılır ve cihaz panelde "Çevrimdışı" görünür.

## Yapılandırma

Cihaz, panelde **Cihazlar → Cihaz ekle** ile oluşturulur. Dönen `og_` önekli token **yalnızca bir kez** gösterilir — cihaza kaydedin. Kaybederseniz cihazı silip yeniden ekleyin (sunucu yalnızca token'ın hash'ini saklar).

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `GATEWAY_URL` | `ws://127.0.0.1:3000/api/device-gateway` | Gateway adresi |
| `DEVICE_ID` | — (zorunlu) | Paneldeki cihaz id'si |
| `DEVICE_TOKEN` | — (zorunlu) | `og_` önekli cihaz token'ı |
| `RELAY_GPIO` | `17` | (yalnız RPi) Röle BCM pini |

ESP32'de yapılandırma `agent.ino` başındaki sabitlerdedir (WiFi, host, id, token).

> **Üretim notu:** API'yi internete açıyorsanız gateway'i TLS arkasına alın
> (reverse proxy ile `wss://`) — token düz metin frame'de gider.

## Fail-closed davranışı

Tüm ajanlar aynı kuralı uygular: **röle varsayılan olarak kapalıdır ve yalnızca sunucudan `allow: true` geldiğinde `openMs` süresince açılır.** WiFi koptuğunda, sunucu erişilemez olduğunda veya kimlik doğrulama başarısız olduğunda hiçbir tarama kapıyı açmaz; cihaz otomatik yeniden bağlanmayı dener (üstel geri çekilme / kütüphane reconnect'i). Üye tarafında bu durum, QR ekranındaki "Turnike bağlantısı şu an yok" uyarısıyla görünür.

## Simülatör kullanımı

```bash
# Etkileşimli: her satır bir tarama sayılır
DEVICE_ID=... DEVICE_TOKEN=og_... node agents/sim/agent.mjs

# Tek atış: tara, sonucu yaz, çık (çıkış kodu: 0 izin, 1 red, 2 hata)
DEVICE_ID=... DEVICE_TOKEN=og_... node agents/sim/agent.mjs --scan "OG1.xxx.yyy"
```

Simülatör her taramada uçtan uca süreyi ms olarak yazar (KPI-1: QR → açılma < 2 sn ölçümü).

## Donanım bağlantısı

**Raspberry Pi (`rpi/agent.py`)**
- USB QR okuyucu HID klavye modunda: okunan kod stdin'e satır olarak düşer.
- Röle modülü: `IN` → BCM 17 (varsayılan), `VCC` → 5V, `GND` → GND. Röle çıkışı turnikenin tetik girişine (kuru kontak).
- `pip install websockets gpiozero` sonrası systemd servisi olarak çalıştırılması önerilir.

**ESP32 (`esp32/agent.ino`)**
- QR modülü (GM65/GM805 vb.) TX → GPIO16 (RX2), 9600 baud, satır sonu `\n`.
- Röle `IN` → GPIO26 (aktif HIGH).
- Kütüphaneler: WebSockets (links2004) ≥ 2.4, ArduinoJson ≥ 7.
