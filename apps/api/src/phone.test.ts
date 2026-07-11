import assert from "node:assert/strict";
import test from "node:test";
import {
  InvalidPhoneNumberError,
  normalizePhoneToE164,
  tryNormalizePhoneToE164,
} from "./phone.js";
import { planLegacyPhoneBackfill } from "./phoneBackfillPlan.js";

test("Türkiye numaralarının yaygın yazımları aynı E.164 değerine dönüşür", () => {
  for (const input of [
    "5301234567",
    "05301234567",
    "+905301234567",
    "(0530) 123 45 67",
  ]) {
    assert.equal(normalizePhoneToE164(input), "+905301234567");
  }
});

test("artı işaretli geçerli uluslararası numara korunur", () => {
  assert.equal(normalizePhoneToE164("+1 213 373 4253"), "+12133734253");
});

test("geçersiz numaralar ve metin içinden ayıklama reddedilir", () => {
  for (const input of [
    "",
    "123",
    "+999123456",
    "Beni 05301234567 ara",
  ] as const) {
    assert.throws(() => normalizePhoneToE164(input), InvalidPhoneNumberError);
    assert.equal(tryNormalizePhoneToE164(input), null);
  }
});

test("eski tekil telefonlar atanır, mükerrerler değiştirilmeden raporlanır", () => {
  const plan = planLegacyPhoneBackfill([
    { userId: "unique", phone: "05301234567" },
    { userId: "duplicate-a", phone: "532 123 45 67" },
    { userId: "duplicate-b", phone: "+90 532 123 45 67" },
    { userId: "invalid", phone: "-" },
    { userId: "seed", phone: "-", exempt: true },
  ]);

  assert.deepEqual(plan.assignments, [
    { userId: "unique", phoneE164: "+905301234567" },
  ]);
  assert.deepEqual(plan.conflicts, [
    {
      phoneE164: "+905321234567",
      users: [{ userId: "duplicate-a" }, { userId: "duplicate-b" }],
    },
  ]);
  assert.deepEqual(plan.invalidUserIds, ["invalid"]);
});

test("önceden normalize edilmiş tekil belge ikinci çalışmada değişmez", () => {
  assert.deepEqual(
    planLegacyPhoneBackfill([
      {
        userId: "normalized",
        phone: "+905301234567",
        phoneE164: "+905301234567",
      },
    ]),
    { assignments: [], conflicts: [], invalidUserIds: [] },
  );
});
