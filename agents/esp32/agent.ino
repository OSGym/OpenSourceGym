// OpenGym turnike ajanı — ESP32 referans uygulaması.
//
// Kütüphaneler (Arduino Library Manager):
//   - "WebSockets" (Markus Sattler / links2004) >= 2.4
//   - "ArduinoJson" >= 7
//
// Donanım varsayımı:
//   - QR okuyucu modül (GM65/GM805 vb.) UART2'de: okuyucu TX -> GPIO16 (RX2),
//     9600 baud, okunan kod satır sonu (\n) ile biter.
//   - Röle modülü GPIO26'da (aktif HIGH), turnike tetik girişini sürer.
//
// Fail-closed: röle varsayılan LOW; yalnızca sunucudan allow geldiğinde
// openMs süresince HIGH. WiFi/sunucu yokken hiçbir tarama kapı açmaz.

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// ---- Yapılandırma (kendi değerlerinizle doldurun) ----
const char* WIFI_SSID    = "SSID";
const char* WIFI_PASS    = "PAROLA";
const char* GW_HOST      = "192.168.1.10";               // API sunucusu
const uint16_t GW_PORT   = 3000;
const char* GW_PATH      = "/api/device-gateway";
const char* DEVICE_ID    = "CIHAZ_ID";                   // panelden
const char* DEVICE_TOKEN = "og_...";                     // panelden, yalnızca bir kez gösterilir

const int RELAY_PIN = 26;
const unsigned long DEFAULT_OPEN_MS = 500;
// ------------------------------------------------------

WebSocketsClient webSocket;
bool authed = false;
unsigned long relayOffAt = 0;  // 0 = röle kapalı/bekleyen kapama yok
String scanBuffer;

void sendAuth() {
  JsonDocument doc;
  doc["type"] = "auth";
  doc["deviceId"] = DEVICE_ID;
  doc["token"] = DEVICE_TOKEN;
  String out;
  serializeJson(doc, out);
  webSocket.sendTXT(out);
}

void openRelay(unsigned long ms) {
  digitalWrite(RELAY_PIN, HIGH);
  relayOffAt = millis() + ms;
}

void onMessage(uint8_t* payload, size_t length) {
  JsonDocument doc;
  if (deserializeJson(doc, payload, length)) return;
  const char* type = doc["type"];
  if (!type) return;

  if (strcmp(type, "auth_ok") == 0) {
    authed = true;
    Serial.printf("[bagli] cihaz: %s\n", (const char*)(doc["deviceName"] | "?"));
  } else if (strcmp(type, "auth_error") == 0) {
    authed = false;
    Serial.printf("[kimlik hatasi] %s\n", (const char*)(doc["message"] | "?"));
  } else if (strcmp(type, "scan_result") == 0) {
    if (doc["allow"] == true) {
      Serial.printf("ACIK  uye: %s\n", (const char*)(doc["memberName"] | "?"));
      openRelay(doc["openMs"] | DEFAULT_OPEN_MS);
    } else {
      Serial.printf("RED   neden: %s — role kapali (fail-closed)\n",
                    (const char*)(doc["reason"] | "?"));
    }
  }
}

void onWsEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      sendAuth();
      break;
    case WStype_DISCONNECTED:
      authed = false;
      Serial.println("[koptu] yeniden baglaniliyor...");
      break;
    case WStype_TEXT:
      onMessage(payload, length);
      break;
    default:
      break;
  }
}

void sendScan(const String& qr) {
  if (!authed) {
    Serial.println("RED   sunucu bagli degil (fail-closed)");
    return;
  }
  JsonDocument doc;
  doc["type"] = "scan";
  doc["qr"] = qr;
  String out;
  serializeJson(doc, out);
  webSocket.sendTXT(out);
}

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);  // açılışta röle kapalı (fail-closed)

  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, 16, 17);  // QR okuyucu UART2

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nWiFi baglandi: %s\n", WiFi.localIP().toString().c_str());

  webSocket.begin(GW_HOST, GW_PORT, GW_PATH);
  webSocket.onEvent(onWsEvent);
  webSocket.setReconnectInterval(3000);  // otomatik yeniden bağlanma
  // Sunucu 30 sn'de bir protokol ping'i atar; kütüphane otomatik pong yanıtlar.
}

void loop() {
  webSocket.loop();

  // Röleyi süresi dolunca kapat (bloklamadan)
  if (relayOffAt != 0 && (long)(millis() - relayOffAt) >= 0) {
    digitalWrite(RELAY_PIN, LOW);
    relayOffAt = 0;
  }

  // QR okuyucudan satır oku
  while (Serial2.available()) {
    char c = (char)Serial2.read();
    if (c == '\n' || c == '\r') {
      if (scanBuffer.length() > 0) {
        sendScan(scanBuffer);
        scanBuffer = "";
      }
    } else if (scanBuffer.length() < 512) {
      scanBuffer += c;
    }
  }
}
