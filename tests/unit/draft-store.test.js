import test from "node:test";
import assert from "node:assert/strict";

import { createDraftStore } from "../../src/client/app/draft-store.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values,
  };
}

function createVault() {
  return {
    isUnlocked: () => true,
    async seal(kind, id, value) {
      const plaintext = Buffer.from(JSON.stringify(value), "utf8").toString("base64");
      return { version: 1, iv: "iv", ciphertext: plaintext, kind, id };
    },
    async open(kind, id, payload) {
      assert.equal(payload.kind, kind);
      assert.equal(payload.id, id);
      return JSON.parse(Buffer.from(payload.ciphertext, "base64").toString("utf8"));
    },
  };
}

const user = { email: "Writer@Example.com" };

test("drafts are sealed before they reach browser storage", async () => {
  const storage = createStorage();
  const store = createDraftStore({ vault: createVault(), user, storage });

  await store.save({ body: "一句话草稿", title: "题目", tags: ["学术"] });

  const raw = [...storage.values.values()][0];
  assert.equal(raw.includes("一句话草稿"), false);
  assert.equal(raw.includes("学术"), false);
  assert.ok(raw.includes("sealed_payload"));
});

test("a stored draft is restored for the same account only", async () => {
  const storage = createStorage();
  const vault = createVault();
  const store = createDraftStore({ vault, user, storage });
  await store.save({ entry_id: null, category: "letter", body: "写给你", recipient: "你" });

  const restored = await createDraftStore({ vault, user, storage }).load();
  assert.equal(restored.body, "写给你");
  assert.equal(restored.category, "letter");
  assert.equal(restored.recipient, "你");

  const other = await createDraftStore({ vault, user: { email: "other@example.com" }, storage }).load();
  assert.equal(other, null);
});

test("clearing removes the encrypted draft and an empty draft is not stored", async () => {
  const storage = createStorage();
  const store = createDraftStore({ vault: createVault(), user, storage });

  assert.equal(await store.save({ body: "   ", title: "", tags: [] }), null);
  assert.equal(storage.values.size, 0);

  await store.save({ body: "留下这一句" });
  assert.equal(storage.values.size, 1);
  store.clear();
  assert.equal(storage.values.size, 0);
  assert.equal(await store.load(), null);
});

test("an undecryptable draft is dropped instead of blocking the desk", async () => {
  const storage = createStorage();
  const store = createDraftStore({ vault: createVault(), user, storage });
  await store.save({ body: "留下这一句" });

  const brokenVault = {
    isUnlocked: () => true,
    seal: async () => ({}),
    open: async () => { throw new Error("locked"); },
  };
  const restored = await createDraftStore({ vault: brokenVault, user, storage }).load();

  assert.equal(restored, null);
  assert.equal(storage.values.size, 0);
});
