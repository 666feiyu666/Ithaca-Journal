import test from "node:test";
import assert from "node:assert/strict";

import { createPrivacyFeature } from "../../src/client/app/privacy-feature.js";
import { createAppState } from "../../src/client/app/state.js";

const ACCOUNT_SECRET = "A".repeat(43);
const PROFILE = { version: 1, verifier: { version: 1 } };

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("first visit obtains an account key silently and migrates legacy plaintext", async () => {
  const state = createAppState();
  const storage = createStorage();
  const calls = [];
  let privacyReads = 0;
  const api = async (path, options = {}) => {
    calls.push({ path, options });
    if (path === "/api/privacy" && !options.method) {
      privacyReads += 1;
      return privacyReads === 1
        ? { profile: null, migration_required: false, key_custody: "none" }
        : { profile: PROFILE, migration_required: false, key_custody: "account" };
    }
    if (path === "/api/privacy/key" && options.method === "POST") {
      assert.deepEqual(JSON.parse(options.body), {});
      return {
        device_secret: ACCOUNT_SECRET,
        key_custody: "account",
        created: true,
      };
    }
    if (path === "/api/privacy" && options.method === "POST") {
      return {
        profile: PROFILE,
        migration_required: true,
        key_custody: "account",
      };
    }
    if (path === "/api/export") {
      return {
        entries: [{
          id: "6e9998ae-efee-4e20-a847-d2f90bb91f01",
          encryption_version: 0,
          title: "旧碎片标题",
          body: "旧碎片正文",
        }],
        topics: [{
          id: "997b5366-d8ab-4bfb-9ac8-240a7f001902",
          encryption_version: 0,
          title: "旧主题标题",
          body: "旧主题正文",
        }],
        books: [{
          id: "39026991-d445-4bb7-a7a5-a27233589251",
          encryption_version: 0,
          title: "旧书名",
          preface: "旧序言",
          content_snapshot: "旧成书正文",
          sources: [{
            topic_id: "997b5366-d8ab-4bfb-9ac8-240a7f001902",
            title: "旧主题标题",
            updated_at: "2026-08-21T00:00:00.000Z",
            fragment_ids: ["6e9998ae-efee-4e20-a847-d2f90bb91f01"],
          }],
        }],
      };
    }
    if (options.method === "PUT") return {};
    throw new Error(`Unexpected API call: ${path}`);
  };

  let unlocked = false;
  const vault = {
    async createProfile(secret) {
      assert.equal(secret, ACCOUNT_SECRET);
      unlocked = true;
      return {
        version: 1,
        kdf: "PBKDF2-SHA256",
        iterations: 600_000,
        salt: "AAAAAAAAAAAAAAAAAAAAAA",
        verifier: { version: 1, iv: "AAAAAAAAAAAAAAAA", ciphertext: "V".repeat(22) },
      };
    },
    async unlock() {
      throw new Error("A new profile should already be unlocked");
    },
    isUnlocked: () => unlocked,
    lock() { unlocked = false; },
    async seal() {
      return { version: 1, iv: "AAAAAAAAAAAAAAAA", ciphertext: "C".repeat(22) };
    },
  };

  const feature = createPrivacyFeature({ state, api, vault, storage });
  await feature.ensureUnlocked({ email: "legacy@example.test", source: "development" });

  assert.equal(state.privacyUnlocked, true);
  assert.deepEqual([...storage.values.values()], []);
  const migrationCalls = calls.filter(({ options }) => options.method === "PUT");
  assert.deepEqual(migrationCalls.map(({ path }) => path), [
    "/api/entries/6e9998ae-efee-4e20-a847-d2f90bb91f01",
    "/api/topics/997b5366-d8ab-4bfb-9ac8-240a7f001902",
    "/api/books/39026991-d445-4bb7-a7a5-a27233589251",
  ]);
  for (const { options } of migrationCalls) {
    assert.equal(options.body.includes("旧碎片"), false);
    assert.equal(options.body.includes("旧主题"), false);
    assert.equal(options.body.includes("旧书"), false);
    assert.equal(JSON.parse(options.body).sealed_payload.version, 1);
  }
});

test("returning account unlocks on a new device without using browser storage", async () => {
  const state = createAppState();
  let receivedSecret = null;
  const vault = {
    async unlock(secret, receivedProfile) {
      receivedSecret = secret;
      assert.equal(receivedProfile, PROFILE);
    },
    isUnlocked: () => Boolean(receivedSecret),
    lock() { receivedSecret = null; },
  };
  const feature = createPrivacyFeature({
    state,
    storage: {
      getItem() { throw new Error("Browser storage must not be read"); },
      setItem() { throw new Error("Browser storage must not be written"); },
    },
    vault,
    api: async (path, options = {}) => {
      if (path === "/api/privacy") {
        assert.equal(options.method, undefined);
        return { profile: PROFILE, migration_required: false, key_custody: "account" };
      }
      assert.equal(path, "/api/privacy/key");
      assert.deepEqual(JSON.parse(options.body), {});
      return {
        device_secret: ACCOUNT_SECRET,
        key_custody: "account",
        created: false,
      };
    },
  });

  await feature.ensureUnlocked({ email: "Writer@Example.Test", source: "cloudflare-access" });

  assert.equal(receivedSecret, ACCOUNT_SECRET);
  assert.equal(state.privacyUnlocked, true);
});

test("an old working device migrates its verified key into account custody", async () => {
  const state = createAppState();
  const storageKey = "ithaca-journal:device-secret:v1:writer%40example.test";
  const storage = createStorage({ [storageKey]: ACCOUNT_SECRET });
  let unlockCount = 0;
  const feature = createPrivacyFeature({
    state,
    storage,
    vault: {
      lock() {},
      async unlock(secret, profile) {
        unlockCount += 1;
        assert.equal(secret, ACCOUNT_SECRET);
        assert.equal(profile, PROFILE);
      },
    },
    api: async (path, options = {}) => {
      if (path === "/api/privacy") {
        return { profile: PROFILE, migration_required: false, key_custody: "device" };
      }
      assert.equal(path, "/api/privacy/key");
      assert.deepEqual(JSON.parse(options.body), { device_secret: ACCOUNT_SECRET });
      return {
        device_secret: ACCOUNT_SECRET,
        key_custody: "account",
        created: true,
      };
    },
  });

  await feature.ensureUnlocked({ email: "writer@example.test", source: "cloudflare-access" });

  assert.equal(unlockCount, 1);
  assert.equal(state.privacyUnlocked, true);
  assert.equal(storage.values.has(storageKey), false);
});

test("a new device explains when an old account still needs one-time migration", async () => {
  const state = createAppState();
  const feature = createPrivacyFeature({
    state,
    storage: createStorage(),
    vault: {
      lock() {},
      async unlock() {
        throw new Error("Unlock should not run without the legacy device key");
      },
    },
    api: async () => ({
      profile: PROFILE,
      migration_required: false,
      key_custody: "device",
    }),
  });

  await assert.rejects(
    feature.ensureUnlocked({ email: "missing@example.test", source: "development" }),
    { code: "account_key_migration_required" },
  );
  assert.equal(state.privacyUnlocked, false);
});
