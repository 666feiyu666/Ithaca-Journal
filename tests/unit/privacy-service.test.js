import test from "node:test";
import assert from "node:assert/strict";

import {
  createDeviceSecret,
  createPrivacyVault,
} from "../../src/client/app/privacy-service.js";

test("browser vault seals content, binds it to its record, and unlocks from a stored device secret", async () => {
  const deviceSecret = createDeviceSecret();
  const entryId = "6e9998ae-efee-4e20-a847-d2f90bb91f01";
  const plaintext = {
    title: "供应商不应看到的标题",
    body: "供应商不应看到的正文。",
  };

  const firstVault = createPrivacyVault();
  const profile = await firstVault.createProfile(deviceSecret);
  const sealedPayload = await firstVault.seal("entry", entryId, plaintext);

  assert.equal(JSON.stringify(profile).includes(deviceSecret), false);
  assert.equal(JSON.stringify(sealedPayload).includes(plaintext.title), false);
  assert.equal(JSON.stringify(sealedPayload).includes(plaintext.body), false);
  assert.deepEqual(
    await firstVault.open("entry", entryId, sealedPayload),
    plaintext,
  );
  await assert.rejects(
    firstVault.open("entry", crypto.randomUUID(), sealedPayload),
    { code: "decrypt_failed" },
  );

  const secondVault = createPrivacyVault();
  await secondVault.unlock(deviceSecret, profile);
  assert.deepEqual(
    await secondVault.open("entry", entryId, sealedPayload),
    plaintext,
  );

  const wrongVault = createPrivacyVault();
  await assert.rejects(
    wrongVault.unlock(createDeviceSecret(), profile),
    { code: "wrong_device_key" },
  );
});

test("plaintext export decrypts entries and sent letters in memory and removes ciphertext fields", async () => {
  const vault = createPrivacyVault();
  await vault.createProfile(createDeviceSecret());
  const entryId = "997b5366-d8ab-4bfb-9ac8-240a7f001902";
  const sealedPayload = await vault.seal("entry", entryId, {
    title: "导出标题",
    body: "导出正文",
    tags: ["学术", "伊萨卡手记"],
    recipient: "",
  });
  const sentLetterId = "37c02640-0897-4f56-a510-5cfdf64df8e7";
  const sentLetterPayload = await vault.seal("sent-letter", sentLetterId, {
    title: "寄出的标题",
    recipient: "糖水菠萝",
    body: "寄出的正文",
  });

  const exported = await vault.openArchive({
    format: "ithaca-journal-export",
    version: 6,
    entries: [{
      id: entryId,
      encryption_version: 1,
      sealed_payload: sealedPayload,
      created_at: "2026-08-22T00:00:00.000Z",
      updated_at: "2026-08-22T00:00:00.000Z",
    }],
    topics: [],
    books: [],
    sent_letters: [{
      id: sentLetterId,
      encryption_version: 1,
      sealed_payload: sentLetterPayload,
      created_at: "2026-08-24T00:00:00.000Z",
    }],
  });

  assert.equal(exported.version, 7);
  assert.equal(exported.entries[0].title, "导出标题");
  assert.equal(exported.entries[0].body, "导出正文");
  assert.deepEqual(exported.entries[0].tags, ["学术", "伊萨卡手记"]);
  assert.equal("sealed_payload" in exported.entries[0], false);
  assert.equal(exported.sent_letters[0].title, "寄出的标题");
  assert.equal(exported.sent_letters[0].recipient, "糖水菠萝");
  assert.equal(exported.sent_letters[0].body, "寄出的正文");
  assert.equal("sealed_payload" in exported.sent_letters[0], false);
});
