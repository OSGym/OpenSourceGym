import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { MongoClient } from "mongodb";
import { buildUserSearchFilter, USER_SEARCH_LIMIT } from "../userSearch.js";

const mongoUri = process.env.TEST_MONGODB_URI;

test(
  "üye araması ad, soyad, tam ad, e-posta ve telefonu kısmi eşleştirir",
  { skip: mongoUri ? false : "TEST_MONGODB_URI tanımlı değil" },
  async () => {
    const client = new MongoClient(mongoUri!);
    const database = client.db(
      `opengym_search_${randomUUID().replaceAll("-", "")}`,
    );
    const users = database.collection("user");

    try {
      await client.connect();
      await users.insertMany([
        {
          name: "Ayşe Yılmaz",
          firstName: "Ayşe",
          lastName: "Yılmaz",
          email: "ayse.yilmaz@example.com",
          phone: "+905301234567",
          phoneE164: "+905301234567",
        },
        {
          name: "Mehmet Kaya",
          firstName: "Mehmet",
          lastName: "Kaya",
          email: "mehmet@example.com",
          phone: "+905551112233",
          phoneE164: "+905551112233",
        },
      ]);

      async function emails(query: string): Promise<string[]> {
        const docs = await users
          .find(buildUserSearchFilter(query))
          .limit(USER_SEARCH_LIMIT)
          .toArray();
        return docs.map((doc) => String(doc.email));
      }

      assert.deepEqual(await emails("AYŞ"), ["ayse.yilmaz@example.com"]);
      assert.deepEqual(await emails("yıl"), ["ayse.yilmaz@example.com"]);
      assert.deepEqual(await emails("Ayşe Yıl"), ["ayse.yilmaz@example.com"]);
      assert.deepEqual(await emails("Ayşe Kaya"), []);
      assert.deepEqual(await emails("yilmaz@example"), [
        "ayse.yilmaz@example.com",
      ]);
      assert.deepEqual(await emails("(530) 123"), ["ayse.yilmaz@example.com"]);
      assert.deepEqual(await emails("05301234567"), [
        "ayse.yilmaz@example.com",
      ]);
      assert.deepEqual(await emails("(0530) 123-45-67"), [
        "ayse.yilmaz@example.com",
      ]);
      assert.deepEqual(await emails("bulunmaz1"), []);

      await users.insertMany(
        Array.from({ length: USER_SEARCH_LIMIT + 5 }, (_, index) => ({
          name: `Limit Üyesi ${index}`,
          firstName: "Limit",
          lastName: `Üyesi ${index}`,
          email: `limit-${index}@example.com`,
          phone: `+90540${String(index).padStart(7, "0")}`,
        })),
      );
      assert.equal((await emails("Limit")).length, USER_SEARCH_LIMIT);
    } finally {
      await database.dropDatabase();
      await client.close();
    }
  },
);
