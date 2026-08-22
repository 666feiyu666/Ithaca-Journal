import { ApiError, requireRecord } from "./http";
import { requirePrivacyProfile } from "./privacy";
import {
  CLIENT_ENCRYPTION_VERSION,
  ENCRYPTED_CONTENT_LABEL,
  parseStoredSealedPayload,
  requireEncryptedRecordPayload,
  requireSealedPayload,
  serializeSealedPayload,
  type SealedPayload,
} from "./sealed";

interface StoredEntryRow {
  id: string;
  title: string;
  body: string;
  body_format: string;
  encryption_version: number;
  created_at: string;
  updated_at: string;
}

interface EntryMetadata {
  id: string;
  encryption_version: number;
  created_at: string;
  updated_at: string;
}

export interface LegacyEntryRecord extends EntryMetadata {
  encryption_version: 0;
  title: string;
  body: string;
  excerpt: string;
  body_format: string;
}

export interface EncryptedEntryRecord extends EntryMetadata {
  encryption_version: 1;
  sealed_payload: SealedPayload;
}

export type EntryRecord = LegacyEntryRecord | EncryptedEntryRecord;

function toEntryRecord(row: StoredEntryRow): EntryRecord {
  const metadata = {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (row.encryption_version === CLIENT_ENCRYPTION_VERSION) {
    return {
      ...metadata,
      encryption_version: CLIENT_ENCRYPTION_VERSION,
      sealed_payload: parseStoredSealedPayload(row.body),
    };
  }
  if (row.encryption_version !== 0) {
    throw new ApiError(500, "unsupported_stored_encryption", "保存的碎片加密版本无法读取。");
  }
  return {
    ...metadata,
    encryption_version: 0,
    title: row.title,
    body: row.body,
    excerpt: row.body.slice(0, 180),
    body_format: row.body_format,
  };
}

async function storedEntry(
  env: Env,
  userId: string,
  entryId: string,
): Promise<StoredEntryRow> {
  const row = await env.DB.prepare(
    `SELECT id, title, body, body_format, encryption_version, created_at, updated_at
     FROM journal_entries
     WHERE id = ?1 AND user_id = ?2`,
  )
    .bind(entryId, userId)
    .first<StoredEntryRow>();
  if (!row) {
    throw new ApiError(404, "entry_not_found", "没有找到这则碎片笔记。");
  }
  return row;
}

export async function listEntries(env: Env, userId: string): Promise<EntryRecord[]> {
  const result = await env.DB.prepare(
    `SELECT id, title, body, body_format, encryption_version, created_at, updated_at
     FROM journal_entries
     WHERE user_id = ?1
     ORDER BY updated_at DESC`,
  )
    .bind(userId)
    .all<StoredEntryRow>();
  return result.results.map(toEntryRecord);
}

export async function getEntry(
  env: Env,
  userId: string,
  entryId: string,
): Promise<EntryRecord> {
  return toEntryRecord(await storedEntry(env, userId, entryId));
}

export async function createEntry(
  env: Env,
  userId: string,
  payload: unknown,
): Promise<EntryRecord> {
  await requirePrivacyProfile(env, userId);
  const { id, sealedPayload } = requireEncryptedRecordPayload(payload);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO journal_entries
       (id, user_id, title, body, body_format, encryption_version, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, 'ciphertext', ?5, ?6, ?6)`,
  )
    .bind(
      id,
      userId,
      ENCRYPTED_CONTENT_LABEL,
      serializeSealedPayload(sealedPayload),
      CLIENT_ENCRYPTION_VERSION,
      now,
    )
    .run();
  return getEntry(env, userId, id);
}

export async function updateEntry(
  env: Env,
  userId: string,
  entryId: string,
  payload: unknown,
): Promise<EntryRecord> {
  await requirePrivacyProfile(env, userId);
  const sealedPayload = requireSealedPayload(requireRecord(payload));
  const result = await env.DB.prepare(
    `UPDATE journal_entries
     SET title = ?1, body = ?2, body_format = 'ciphertext', encryption_version = ?3,
         updated_at = ?4
     WHERE id = ?5 AND user_id = ?6`,
  )
    .bind(
      ENCRYPTED_CONTENT_LABEL,
      serializeSealedPayload(sealedPayload),
      CLIENT_ENCRYPTION_VERSION,
      new Date().toISOString(),
      entryId,
      userId,
    )
    .run();
  if (result.meta.changes !== 1) {
    throw new ApiError(404, "entry_not_found", "没有找到这则碎片笔记。");
  }
  return getEntry(env, userId, entryId);
}

export async function deleteEntry(
  env: Env,
  userId: string,
  entryId: string,
): Promise<void> {
  const result = await env.DB.prepare(
    "DELETE FROM journal_entries WHERE id = ?1 AND user_id = ?2",
  )
    .bind(entryId, userId)
    .run();
  if (result.meta.changes < 1) {
    throw new ApiError(404, "entry_not_found", "没有找到这则碎片笔记。");
  }
}

export async function exportEntries(env: Env, userId: string): Promise<EntryRecord[]> {
  const result = await env.DB.prepare(
    `SELECT id, title, body, body_format, encryption_version, created_at, updated_at
     FROM journal_entries
     WHERE user_id = ?1
     ORDER BY created_at ASC`,
  )
    .bind(userId)
    .all<StoredEntryRow>();
  return result.results.map(toEntryRecord);
}
