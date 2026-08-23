import { ApiError, requireRecord } from "./http";

const ENVELOPE_VERSION = 1;
const ENVELOPE_ALGORITHM = "AES-GCM-256";
const ACCOUNT_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const IV_PATTERN = /^[A-Za-z0-9_-]{16}$/;
const CIPHERTEXT_PATTERN = /^[A-Za-z0-9_-]{79}$/;
const ACCOUNT_SECRET_BYTES = 32;
const IV_BYTES = 12;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });

interface AccountVaultKeyRow {
  envelope_version: number;
  algorithm: string;
  iv: string;
  ciphertext: string;
  created_at: string;
  updated_at: string;
}

export type KeyCustody = "none" | "device" | "account";

export interface AccountVaultKeyResult {
  device_secret: string;
  key_custody: "account";
  created: boolean;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new ApiError(500, "invalid_key_envelope", "账户存档暂时无法打开。");
  }
  try {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + padding);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch (error) {
    throw new ApiError(
      500,
      "invalid_key_envelope",
      "账户存档暂时无法打开。",
      {},
      { cause: error },
    );
  }
}

function randomAccountSecret(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(ACCOUNT_SECRET_BYTES)));
}

function envelopeAad(userId: string): Uint8Array {
  return encoder.encode(`ithaca-journal:account-vault-key:v${ENVELOPE_VERSION}:${userId}`);
}

async function importEnvelopeKey(env: Env): Promise<CryptoKey> {
  const encodedKey = env.VAULT_KEY_ENCRYPTION_KEY;
  if (!ACCOUNT_SECRET_PATTERN.test(encodedKey)) {
    throw new ApiError(500, "vault_key_unavailable", "账户存档服务暂时不可用。");
  }
  const keyBytes = base64UrlToBytes(encodedKey);
  if (keyBytes.byteLength !== ACCOUNT_SECRET_BYTES) {
    throw new ApiError(500, "vault_key_unavailable", "账户存档服务暂时不可用。");
  }
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

async function sealAccountSecret(
  env: Env,
  userId: string,
  accountSecret: string,
): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: envelopeAad(userId),
      tagLength: 128,
    },
    await importEnvelopeKey(env),
    encoder.encode(accountSecret),
  );
  return {
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
  };
}

async function openAccountSecret(
  env: Env,
  userId: string,
  row: AccountVaultKeyRow,
): Promise<string> {
  if (
    row.envelope_version !== ENVELOPE_VERSION
    || row.algorithm !== ENVELOPE_ALGORITHM
    || !IV_PATTERN.test(row.iv)
    || !CIPHERTEXT_PATTERN.test(row.ciphertext)
  ) {
    throw new ApiError(500, "invalid_key_envelope", "账户存档暂时无法打开。");
  }
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64UrlToBytes(row.iv),
        additionalData: envelopeAad(userId),
        tagLength: 128,
      },
      await importEnvelopeKey(env),
      base64UrlToBytes(row.ciphertext),
    );
    const accountSecret = decoder.decode(plaintext);
    if (!ACCOUNT_SECRET_PATTERN.test(accountSecret)) {
      throw new Error("Invalid account secret");
    }
    return accountSecret;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      500,
      "key_envelope_open_failed",
      "账户存档暂时无法打开。",
      {},
      { cause: error },
    );
  }
}

async function accountVaultKeyRow(
  env: Env,
  userId: string,
): Promise<AccountVaultKeyRow | null> {
  return env.DB.prepare(
    `SELECT envelope_version, algorithm, iv, ciphertext, created_at, updated_at
     FROM account_vault_keys
     WHERE user_id = ?1`,
  )
    .bind(userId)
    .first<AccountVaultKeyRow>();
}

async function hasPrivacyProfile(env: Env, userId: string): Promise<boolean> {
  return Boolean(
    await env.DB.prepare("SELECT 1 AS present FROM privacy_profiles WHERE user_id = ?1")
      .bind(userId)
      .first<{ present: number }>(),
  );
}

export async function getKeyCustody(env: Env, userId: string): Promise<KeyCustody> {
  if (await accountVaultKeyRow(env, userId)) return "account";
  return (await hasPrivacyProfile(env, userId)) ? "device" : "none";
}

export async function provideAccountVaultKey(
  env: Env,
  userId: string,
  payload: unknown,
): Promise<AccountVaultKeyResult> {
  const record = requireRecord(payload);
  const suppliedSecret = record.device_secret;
  if (suppliedSecret !== undefined && (
    typeof suppliedSecret !== "string" || !ACCOUNT_SECRET_PATTERN.test(suppliedSecret)
  )) {
    throw new ApiError(422, "invalid_account_key", "账户存档迁移数据无效。");
  }

  const existing = await accountVaultKeyRow(env, userId);
  if (existing) {
    return {
      device_secret: await openAccountSecret(env, userId, existing),
      key_custody: "account",
      created: false,
    };
  }

  if (await hasPrivacyProfile(env, userId) && typeof suppliedSecret !== "string") {
    throw new ApiError(
      409,
      "account_key_migration_required",
      "这个账号还没有完成多设备迁移，请先在原电脑打开一次。",
    );
  }

  const accountSecret = typeof suppliedSecret === "string"
    ? suppliedSecret
    : randomAccountSecret();
  const envelope = await sealAccountSecret(env, userId, accountSecret);
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO account_vault_keys
       (user_id, envelope_version, algorithm, iv, ciphertext, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`,
  )
    .bind(
      userId,
      ENVELOPE_VERSION,
      ENVELOPE_ALGORITHM,
      envelope.iv,
      envelope.ciphertext,
      now,
    )
    .run();

  const saved = await accountVaultKeyRow(env, userId);
  if (!saved) {
    throw new ApiError(500, "account_key_not_saved", "账户存档没有准备成功。");
  }
  return {
    device_secret: await openAccountSecret(env, userId, saved),
    key_custody: "account",
    created: result.meta.changes > 0,
  };
}
