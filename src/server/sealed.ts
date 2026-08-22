import { ApiError, requireRecord, requireString } from "./http";

export const CLIENT_ENCRYPTION_VERSION = 1;
export const ENCRYPTED_CONTENT_LABEL = "端侧加密内容";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const AES_GCM_IV_LENGTH = 16;
const MIN_CIPHERTEXT_LENGTH = 22;
const MAX_CIPHERTEXT_LENGTH = 1_500_000;

export interface SealedPayload {
  version: 1;
  iv: string;
  ciphertext: string;
}

function validateSealedPayload(
  value: unknown,
  status: 422 | 500,
): SealedPayload {
  const fail = (code: string, message: string): never => {
    throw new ApiError(status, code, message);
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fail("invalid_sealed_payload", "加密内容格式无效。");
  }
  const record = value as Record<string, unknown>;
  if (record.version !== CLIENT_ENCRYPTION_VERSION) {
    return fail("unsupported_encryption_version", "加密内容版本不受支持。");
  }
  if (typeof record.iv !== "string" || record.iv.length !== AES_GCM_IV_LENGTH) {
    return fail("invalid_encryption_iv", "加密内容的随机向量无效。");
  }
  if (!BASE64URL_PATTERN.test(record.iv)) {
    return fail("invalid_encryption_iv", "加密内容的随机向量无效。");
  }
  if (
    typeof record.ciphertext !== "string"
    || record.ciphertext.length < MIN_CIPHERTEXT_LENGTH
    || record.ciphertext.length > MAX_CIPHERTEXT_LENGTH
    || !BASE64URL_PATTERN.test(record.ciphertext)
  ) {
    return fail("invalid_ciphertext", "密文内容无效或超过大小限制。");
  }
  return {
    version: CLIENT_ENCRYPTION_VERSION,
    iv: record.iv,
    ciphertext: record.ciphertext,
  };
}

export function requireUuid(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);
  if (!UUID_PATTERN.test(value)) {
    throw new ApiError(422, "invalid_id", `${key} 不是有效的记录标识。`);
  }
  return value;
}

export function requireSealedPayload(record: Record<string, unknown>): SealedPayload {
  return validateSealedPayload(record.sealed_payload, 422);
}

export function parseStoredSealedPayload(serialized: string): SealedPayload {
  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch {
    throw new ApiError(500, "invalid_stored_ciphertext", "保存的密文格式无法读取。");
  }
  return validateSealedPayload(value, 500);
}

export function serializeSealedPayload(payload: SealedPayload): string {
  return JSON.stringify(payload);
}

export function requireUuidArray(
  record: Record<string, unknown>,
  key: string,
  { required = false, maximum = 50 } = {},
): string[] | null {
  const value = record[key];
  if (value === undefined && !required) {
    return null;
  }
  if (!Array.isArray(value) || (required && value.length === 0)) {
    throw new ApiError(422, "invalid_ids", `${key} 必须是${required ? "非空" : ""}数组。`);
  }
  if (value.length > maximum) {
    throw new ApiError(422, "too_many_ids", `${key} 中的记录数量超过限制。`);
  }
  if (!value.every((id) => typeof id === "string" && UUID_PATTERN.test(id))) {
    throw new ApiError(422, "invalid_ids", `${key} 包含无效的记录标识。`);
  }
  return [...new Set(value as string[])];
}

export function requireEncryptedRecordPayload(payload: unknown): {
  id: string;
  sealedPayload: SealedPayload;
} {
  const record = requireRecord(payload);
  return {
    id: requireUuid(record, "id"),
    sealedPayload: requireSealedPayload(record),
  };
}
