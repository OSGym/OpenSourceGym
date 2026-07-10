import assert from "node:assert/strict";
import test from "node:test";
import { parseUserSearchQuery, tokenizeUserSearchQuery } from "./userSearch.js";

test("üye araması en az iki karakter kabul eder", () => {
  assert.equal(parseUserSearchQuery(undefined), null);
  assert.equal(parseUserSearchQuery(" a "), null);
  assert.equal(parseUserSearchQuery("  ay  "), "ay");
});

test("üye araması sorguyu boşluklara göre terimlere ayırır", () => {
  assert.deepEqual(tokenizeUserSearchQuery("  Ayşe\t Yılmaz  "), [
    "Ayşe",
    "Yılmaz",
  ]);
});
