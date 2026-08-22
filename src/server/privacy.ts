import { ApiError, requireRecord, requireString } from "./http";
import {
  parseStoredSealedPayload,
  requireSealedPayload,
  serializeSealedPayload,
  type SealedPayload,
} from "./sealed";

const PRIVACY_PROFILE_VERSION = 1;
const KDF_NAME = "PBKDF2-SHA256";
const KDF_ITERATIONS = 600_000;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const SALT_LENGTH = 22;

interface PrivacyProfileRow {
  profile_version: number;
  kdf_name: string;
  kdf_iterations: number;
  salt: string;
  verifier_payload: string;
  created_at: string;
}

export interface PrivacyProfile {
  version: number;
  kdf: string;
  iterations: number;
  salt: string;
  verifier: SealedPayload;
  created_at: string;
}

interface LegacyCountRow {
  legacy_entries: number;
  legacy_topics: number;
  legacy_books: number;
}

async function hasLegacyContent(env: Env, userId: string): Promise<boolean> {
  const counts = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM journal_entries
        WHERE user_id = ?1 AND encryption_version = 0) AS legacy_entries,
       (SELECT COUNT(*) FROM topics
        WHERE user_id = ?1 AND encryption_version = 0) AS legacy_topics,
       (SELECT COUNT(*) FROM books
        WHERE user_id = ?1 AND encryption_version = 0) AS legacy_books`,
  )
    .bind(userId)
    .first<LegacyCountRow>();

  return Boolean(
    counts
    && (counts.legacy_entries > 0 || counts.legacy_topics > 0 || counts.legacy_books > 0),
  );
}

function toPrivacyProfile(row: PrivacyProfileRow): PrivacyProfile {
  return {
    version: row.profile_version,
    kdf: row.kdf_name,
    iterations: row.kdf_iterations,
    salt: row.salt,
    verifier: parseStoredSealedPayload(row.verifier_payload),
    created_at: row.created_at,
  };
}

async function privacyProfileRow(env: Env, userId: string): Promise<PrivacyProfileRow | null> {
  return env.DB.prepare(
    `SELECT profile_version, kdf_name, kdf_iterations, salt, verifier_payload, created_at
     FROM privacy_profiles
     WHERE user_id = ?1`,
  )
    .bind(userId)
    .first<PrivacyProfileRow>();
}

export async function requirePrivacyProfile(env: Env, userId: string): Promise<void> {
  const row = await env.DB.prepare(
    "SELECT 1 AS present FROM privacy_profiles WHERE user_id = ?1",
  )
    .bind(userId)
    .first<{ present: number }>();
  if (!row) {
    throw new ApiError(
      409,
      "privacy_profile_required",
      "浏览器尚未建立本地加密配置。",
    );
  }
}

export async function getPrivacyStatus(
  env: Env,
  userId: string,
): Promise<{ profile: PrivacyProfile | null; migration_required: boolean }> {
  const row = await privacyProfileRow(env, userId);
  if (!row) {
    return { profile: null, migration_required: false };
  }
  return {
    profile: toPrivacyProfile(row),
    migration_required: await hasLegacyContent(env, userId),
  };
}

export async function createPrivacyProfile(
  env: Env,
  userId: string,
  payload: unknown,
): Promise<{ profile: PrivacyProfile; migration_required: boolean }> {
  const record = requireRecord(payload);
  if (record.version !== PRIVACY_PROFILE_VERSION) {
    throw new ApiError(422, "unsupported_privacy_profile", "隐私配置版本不受支持。");
  }
  const kdf = requireString(record, "kdf");
  const iterations = record.iterations;
  const salt = requireString(record, "salt");
  if (kdf !== KDF_NAME || iterations !== KDF_ITERATIONS) {
    throw new ApiError(422, "unsupported_kdf", "浏览器密钥派生参数不受支持。");
  }
  if (salt.length !== SALT_LENGTH || !BASE64URL_PATTERN.test(salt)) {
    throw new ApiError(422, "invalid_kdf_salt", "浏览器密钥的随机盐无效。");
  }
  const verifier = requireSealedPayload(record);
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO privacy_profiles
       (user_id, profile_version, kdf_name, kdf_iterations, salt, verifier_payload, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  )
    .bind(
      userId,
      PRIVACY_PROFILE_VERSION,
      kdf,
      iterations,
      salt,
      serializeSealedPayload(verifier),
      now,
    )
    .run();

  const saved = await privacyProfileRow(env, userId);
  if (!saved) {
    throw new ApiError(500, "privacy_profile_not_saved", "隐私配置没有保存成功。");
  }
  if (
    result.meta.changes === 0
    && (
      saved.profile_version !== PRIVACY_PROFILE_VERSION
      || saved.kdf_name !== kdf
      || saved.kdf_iterations !== iterations
      || saved.salt !== salt
      || saved.verifier_payload !== serializeSealedPayload(verifier)
    )
  ) {
    throw new ApiError(409, "privacy_profile_exists", "这个账户已经建立了本地加密配置。");
  }

  return {
    profile: toPrivacyProfile(saved),
    migration_required: await hasLegacyContent(env, userId),
  };
}
