const PROFILE_VERSION = 1;
const ENCRYPTION_VERSION = 1;
const KDF = "PBKDF2-SHA256";
const KDF_ITERATIONS = 600_000;
const VERIFIER_TEXT = "ithaca-journal-browser-encryption-v1";
const VERIFIER_AAD = "ithaca-journal:privacy-verifier:v1";
const DEVICE_SECRET_BYTES = 32;

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export class PrivacyVaultError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "PrivacyVaultError";
    this.code = code;
  }
}

function bytesToBase64Url(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function base64UrlToBytes(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new PrivacyVaultError("invalid_ciphertext", "保存的密文格式无效。");
  }
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + padding);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function randomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function createDeviceSecret() {
  return bytesToBase64Url(randomBytes(DEVICE_SECRET_BYTES));
}

function recordAad(kind, id) {
  return `ithaca-journal:v1:${kind}:${id}`;
}

async function deriveKey(deviceSecret, profile) {
  if (
    profile?.version !== PROFILE_VERSION
    || profile?.kdf !== KDF
    || profile?.iterations !== KDF_ITERATIONS
  ) {
    throw new PrivacyVaultError("unsupported_profile", "这个账户的隐私配置版本不受支持。");
  }
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(deviceSecret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64UrlToBytes(profile.salt),
      iterations: profile.iterations,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptJson(key, additionalData, value) {
  const iv = randomBytes(12);
  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: encoder.encode(additionalData),
      tagLength: 128,
    },
    key,
    plaintext,
  );
  return {
    version: ENCRYPTION_VERSION,
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
  };
}

async function decryptJson(key, additionalData, sealedPayload) {
  if (
    sealedPayload?.version !== ENCRYPTION_VERSION
    || typeof sealedPayload?.iv !== "string"
    || typeof sealedPayload?.ciphertext !== "string"
  ) {
    throw new PrivacyVaultError("invalid_ciphertext", "保存的密文格式无效。");
  }
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64UrlToBytes(sealedPayload.iv),
        additionalData: encoder.encode(additionalData),
        tagLength: 128,
      },
      key,
      base64UrlToBytes(sealedPayload.ciphertext),
    );
    return JSON.parse(decoder.decode(plaintext));
  } catch (error) {
    if (error instanceof PrivacyVaultError) throw error;
    throw new PrivacyVaultError(
      "decrypt_failed",
      "无法解密内容。本地密钥不可用，或云端密文已经损坏。",
      { cause: error },
    );
  }
}

function requireText(record, key, label) {
  const value = record?.[key];
  if (typeof value !== "string") {
    throw new PrivacyVaultError("invalid_plaintext", `${label}解密后的内容格式无效。`);
  }
  return value;
}

function withoutCiphertext(record) {
  const { sealed_payload: _sealedPayload, ...metadata } = record;
  return metadata;
}

function legacyEntry(record) {
  return {
    ...record,
    tags: Array.isArray(record.tags) ? record.tags : [],
    excerpt: typeof record.excerpt === "string"
      ? record.excerpt
      : String(record.body ?? "").slice(0, 180),
  };
}

export function createPrivacyVault() {
  let key = null;

  function requireKey() {
    if (!key) {
      throw new PrivacyVaultError("locked", "手记尚未解锁。");
    }
    return key;
  }

  async function createProfile(deviceSecret) {
    const profile = {
      version: PROFILE_VERSION,
      kdf: KDF,
      iterations: KDF_ITERATIONS,
      salt: bytesToBase64Url(randomBytes(16)),
    };
    const nextKey = await deriveKey(deviceSecret, profile);
    const verifier = await encryptJson(nextKey, VERIFIER_AAD, VERIFIER_TEXT);
    key = nextKey;
    return { ...profile, verifier };
  }

  async function unlock(deviceSecret, profile) {
    const nextKey = await deriveKey(deviceSecret, profile);
    let verified;
    try {
      verified = await decryptJson(nextKey, VERIFIER_AAD, profile.verifier);
    } catch (error) {
      throw new PrivacyVaultError(
        "wrong_device_key",
        "这个浏览器保存的本地密钥无法打开现有手记。",
        { cause: error },
      );
    }
    if (verified !== VERIFIER_TEXT) {
      throw new PrivacyVaultError(
        "wrong_device_key",
        "这个浏览器保存的本地密钥无法打开现有手记。",
      );
    }
    key = nextKey;
  }

  async function seal(kind, id, value) {
    return encryptJson(requireKey(), recordAad(kind, id), value);
  }

  async function open(kind, id, sealedPayload) {
    return decryptJson(requireKey(), recordAad(kind, id), sealedPayload);
  }

  async function openEntry(record) {
    if (record?.encryption_version === 0 || record?.encryption_version === undefined) {
      return legacyEntry(record);
    }
    const content = await open("entry", record.id, record.sealed_payload);
    const title = requireText(content, "title", "纸页");
    const body = requireText(content, "body", "纸页");
    const tags = Array.isArray(content?.tags)
      ? [...new Set(content.tags.filter((tag) => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean))]
      : [];
    return {
      ...withoutCiphertext(record),
      title,
      body,
      tags,
      recipient: typeof content?.recipient === "string" ? content.recipient : "",
      excerpt: body.slice(0, 180),
      body_format: "plain",
    };
  }

  async function openTopic(record) {
    let topic;
    if (record?.encryption_version === 0 || record?.encryption_version === undefined) {
      topic = record;
    } else {
      const content = await open("topic", record.id, record.sealed_payload);
      topic = {
        ...withoutCiphertext(record),
        title: requireText(content, "title", "主题"),
        body: requireText(content, "body", "主题"),
      };
    }
    if (!Array.isArray(topic.fragments)) return topic;
    return {
      ...topic,
      fragments: await Promise.all(topic.fragments.map((fragment) => openEntry(fragment))),
    };
  }

  async function openBook(record) {
    if (record?.encryption_version === 0 || record?.encryption_version === undefined) {
      return record;
    }
    const content = await open("book", record.id, record.sealed_payload);
    const sources = Array.isArray(content?.sources) ? content.sources : [];
    return {
      ...withoutCiphertext(record),
      title: requireText(content, "title", "成书"),
      preface: requireText(content, "preface", "成书"),
      content_snapshot: requireText(content, "content_snapshot", "成书"),
      sources,
    };
  }

  async function openSentLetter(record) {
    const content = await open("sent-letter", record.id, record.sealed_payload);
    return {
      ...withoutCiphertext(record),
      title: requireText(content, "title", "寄件"),
      recipient: requireText(content, "recipient", "寄件"),
      body: requireText(content, "body", "寄件"),
    };
  }

  async function openArchive(archive) {
    const [entries, topics, books, sentLetters] = await Promise.all([
      Promise.all((archive.entries ?? []).map((entry) => openEntry(entry))),
      Promise.all((archive.topics ?? []).map((topic) => openTopic(topic))),
      Promise.all((archive.books ?? []).map((book) => openBook(book))),
      Promise.all((archive.sent_letters ?? []).map((letter) => openSentLetter(letter))),
    ]);
    return {
      ...archive,
      version: 6,
      exported_at: new Date().toISOString(),
      entries: entries.map(({ sealed_payload: _sealedPayload, ...entry }) => entry),
      topics: topics.map(({ sealed_payload: _sealedPayload, ...topic }) => ({
        ...topic,
        fragments: topic.fragments?.map(({ sealed_payload: _fragmentCiphertext, ...fragment }) => (
          fragment
        )) ?? [],
      })),
      books: books.map(({ sealed_payload: _sealedPayload, ...book }) => book),
      sent_letters: sentLetters.map(({ sealed_payload: _sealedPayload, ...letter }) => letter),
    };
  }

  function lock() {
    key = null;
  }

  return Object.freeze({
    createProfile,
    isUnlocked: () => Boolean(key),
    lock,
    open,
    openArchive,
    openBook,
    openEntry,
    openSentLetter,
    openTopic,
    seal,
    unlock,
  });
}
