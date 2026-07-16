import assert from "node:assert/strict";
import test from "node:test";
import { resolveLanguage } from "./core";
import { resources } from "./resources";

test("kayıtlı dil cihaz tercihlerinden önce gelir", () => {
  assert.equal(resolveLanguage("tr", ["en-US"]), "tr");
  assert.equal(resolveLanguage("en", ["tr-TR"]), "en");
});

test("ilk desteklenen cihaz dili seçilir", () => {
  assert.equal(resolveLanguage(null, ["de-DE", "tr-TR", "en-US"]), "tr");
  assert.equal(resolveLanguage(null, ["fr-FR", "en-GB"]), "en");
});

test("bozuk veya desteklenmeyen tercihler İngilizceye düşer", () => {
  assert.equal(resolveLanguage("de", ["fr-FR"]), "en");
  assert.equal(resolveLanguage(null, []), "en");
});

test("Türkçe ve İngilizce kaynaklar aynı anahtarları içerir", () => {
  assert.deepEqual(
    Object.keys(resources.tr.translation).sort(),
    Object.keys(resources.en.translation).sort(),
  );
});
