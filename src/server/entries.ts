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
  category: string | null;
  writing_category: string | null;
  source_topic_id: string | null;
  source_letter_day: number | null;
  created_at: string;
  updated_at: string;
}

interface EntryMetadata {
  id: string;
  encryption_version: number;
  category: EntryCategory;
  source_topic_id: string | null;
  source_letter_day: number | null;
  created_at: string;
  updated_at: string;
}

export const ENTRY_CATEGORIES = ["fragment", "theme", "letter", "book", "journal"] as const;
export type EntryCategory = (typeof ENTRY_CATEGORIES)[number] | null;

function legacyCategory(category: EntryCategory): Exclude<EntryCategory, "journal"> {
  return category === "journal" ? "fragment" : category;
}

function requireEntryCategory(
  record: Record<string, unknown>,
  fallback: EntryCategory,
): EntryCategory {
  const value = record.category;
  if (value === undefined) return fallback;
  if (value === null) return null;
  if (typeof value !== "string" || !ENTRY_CATEGORIES.includes(value as NonNullable<EntryCategory>)) {
    throw new ApiError(422, "invalid_entry_category", "纸页分类无效。");
  }
  return value as NonNullable<EntryCategory>;
}

function optionalUuid(
  record: Record<string, unknown>,
  key: string,
): string | null | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new ApiError(422, "invalid_id", `${key} 不是有效的记录标识。`);
  }
  return value;
}

function optionalLetterDay(
  record: Record<string, unknown>,
): number | null | undefined {
  const value = record.source_letter_day;
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 21) {
    throw new ApiError(422, "invalid_letter_day", "来源来信日次必须在 1 到 21 之间。");
  }
  return value;
}

async function requireValidSources(
  env: Env,
  userId: string,
  category: EntryCategory,
  sourceTopicId: string | null,
  sourceLetterDay: number | null,
): Promise<void> {
  if (sourceTopicId !== null) {
    if (category !== "theme") {
      throw new ApiError(422, "invalid_topic_source", "只有主题纸页可以关联公告板。");
    }
    const topic = await env.DB.prepare(
      "SELECT id FROM topics WHERE id = ?1 AND user_id = ?2",
    ).bind(sourceTopicId, userId).first<{ id: string }>();
    if (!topic) {
      throw new ApiError(422, "topic_not_found", "来源主题不存在或不属于当前账户。");
    }
  }
  if (sourceLetterDay !== null) {
    if (category !== "letter") {
      throw new ApiError(422, "invalid_letter_source", "只有书信纸页可以关联来信。");
    }
    const journey = await env.DB.prepare(
      `SELECT current_day, intro_completed_at
       FROM journeys
       WHERE user_id = ?1`,
    ).bind(userId).first<{ current_day: number; intro_completed_at: string | null }>();
    if (!journey?.intro_completed_at || sourceLetterDay > journey.current_day) {
      throw new ApiError(422, "letter_not_available", "这封来源来信尚未送达。");
    }
  }
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
    category: (row.writing_category ?? row.category) as EntryCategory,
    source_topic_id: row.source_topic_id,
    source_letter_day: row.source_letter_day,
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
    `SELECT id, title, body, body_format, encryption_version, category, writing_category,
            source_topic_id, source_letter_day, created_at, updated_at
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
    `SELECT id, title, body, body_format, encryption_version, category, writing_category,
            source_topic_id, source_letter_day, created_at, updated_at
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
  const record = requireRecord(payload);
  const { id, sealedPayload } = requireEncryptedRecordPayload(payload);
  const category = requireEntryCategory(record, "fragment");
  const sourceTopicId = optionalUuid(record, "source_topic_id") ?? null;
  const sourceLetterDay = optionalLetterDay(record) ?? null;
  await requireValidSources(env, userId, category, sourceTopicId, sourceLetterDay);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO journal_entries
       (id, user_id, title, body, body_format, encryption_version, category,
        writing_category, source_topic_id, source_letter_day, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, 'ciphertext', ?5, ?6, ?7, ?8, ?9, ?10, ?10)`,
  )
    .bind(
      id,
      userId,
      ENCRYPTED_CONTENT_LABEL,
      serializeSealedPayload(sealedPayload),
      CLIENT_ENCRYPTION_VERSION,
      legacyCategory(category),
      category,
      sourceTopicId,
      sourceLetterDay,
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
  const stored = await storedEntry(env, userId, entryId);
  const record = requireRecord(payload);
  const sealedPayload = requireSealedPayload(record);
  const storedCategory = (stored.writing_category ?? stored.category) as EntryCategory;
  const category = requireEntryCategory(record, storedCategory);
  const requestedTopicId = optionalUuid(record, "source_topic_id");
  const requestedLetterDay = optionalLetterDay(record);
  if (requestedTopicId !== undefined && requestedTopicId !== null && category !== "theme") {
    throw new ApiError(422, "invalid_topic_source", "只有主题纸页可以关联公告板。");
  }
  if (requestedLetterDay !== undefined && requestedLetterDay !== null && category !== "letter") {
    throw new ApiError(422, "invalid_letter_source", "只有书信纸页可以关联来信。");
  }
  const sourceTopicId = category === "theme"
    ? (requestedTopicId === undefined ? stored.source_topic_id : requestedTopicId)
    : null;
  const sourceLetterDay = category === "letter"
    ? (requestedLetterDay === undefined ? stored.source_letter_day : requestedLetterDay)
    : null;
  await requireValidSources(env, userId, category, sourceTopicId, sourceLetterDay);
  const result = await env.DB.prepare(
    `UPDATE journal_entries
     SET title = ?1, body = ?2, body_format = 'ciphertext', encryption_version = ?3,
         category = ?4, writing_category = ?5, source_topic_id = ?6,
         source_letter_day = ?7, updated_at = ?8
     WHERE id = ?9 AND user_id = ?10`,
  )
    .bind(
      ENCRYPTED_CONTENT_LABEL,
      serializeSealedPayload(sealedPayload),
      CLIENT_ENCRYPTION_VERSION,
      legacyCategory(category),
      category,
      sourceTopicId,
      sourceLetterDay,
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
    `SELECT id, title, body, body_format, encryption_version, category, writing_category,
            source_topic_id, source_letter_day, created_at, updated_at
     FROM journal_entries
     WHERE user_id = ?1
     ORDER BY created_at ASC`,
  )
    .bind(userId)
    .all<StoredEntryRow>();
  return result.results.map(toEntryRecord);
}
