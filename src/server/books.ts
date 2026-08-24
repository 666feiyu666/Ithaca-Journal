import { ApiError, requireRecord } from "./http";
import { requirePrivacyProfile } from "./privacy";
import {
  CLIENT_ENCRYPTION_VERSION,
  ENCRYPTED_CONTENT_LABEL,
  parseStoredSealedPayload,
  requireSealedPayload,
  requireUuid,
  requireUuidArray,
  serializeSealedPayload,
  type SealedPayload,
} from "./sealed";

interface StoredBookRow {
  id: string;
  title: string;
  preface: string;
  content_snapshot: string;
  source_snapshot: string;
  source_entry_id: string | null;
  encryption_version: number;
  created_at: string;
}

interface BookSourceSnapshot {
  topic_id: string;
  title: string;
  updated_at: string;
  fragment_ids: string[];
}

interface BookMetadata {
  id: string;
  encryption_version: number;
  source_entry_id: string | null;
  created_at: string;
}

export interface LegacyBookRecord extends BookMetadata {
  encryption_version: 0;
  title: string;
  preface: string;
  content_snapshot: string;
  sources: BookSourceSnapshot[];
}

export interface EncryptedBookRecord extends BookMetadata {
  encryption_version: 1;
  sealed_payload: SealedPayload;
  source_topic_ids: string[];
}

export type BookRecord = LegacyBookRecord | EncryptedBookRecord;

const MAX_BOOK_TOPICS = 20;

function parseLegacySources(serialized: string): BookSourceSnapshot[] {
  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch {
    throw new ApiError(500, "invalid_book_snapshot", "这本书的来源快照无法读取。");
  }
  if (!Array.isArray(value)) {
    throw new ApiError(500, "invalid_book_snapshot", "这本书的来源快照无法读取。");
  }
  return value as BookSourceSnapshot[];
}

function parseEncryptedSourceIds(serialized: string): string[] {
  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch {
    throw new ApiError(500, "invalid_book_snapshot", "这本书的来源索引无法读取。");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(500, "invalid_book_snapshot", "这本书的来源索引无法读取。");
  }
  const topicIds = (value as Record<string, unknown>).topic_ids;
  if (!Array.isArray(topicIds) || !topicIds.every((id) => typeof id === "string")) {
    throw new ApiError(500, "invalid_book_snapshot", "这本书的来源索引无法读取。");
  }
  return topicIds as string[];
}

function toBookRecord(row: StoredBookRow): BookRecord {
  const metadata = {
    id: row.id,
    source_entry_id: row.source_entry_id,
    created_at: row.created_at,
  };
  if (row.encryption_version === CLIENT_ENCRYPTION_VERSION) {
    return {
      ...metadata,
      encryption_version: CLIENT_ENCRYPTION_VERSION,
      sealed_payload: parseStoredSealedPayload(row.content_snapshot),
      source_topic_ids: parseEncryptedSourceIds(row.source_snapshot),
    };
  }
  if (row.encryption_version !== 0) {
    throw new ApiError(500, "unsupported_stored_encryption", "保存的成书加密版本无法读取。");
  }
  return {
    ...metadata,
    encryption_version: 0,
    title: row.title,
    preface: row.preface,
    content_snapshot: row.content_snapshot,
    sources: parseLegacySources(row.source_snapshot),
  };
}

function validateBookPayload(payload: unknown, requireId: boolean): {
  id: string | null;
  sealedPayload: SealedPayload;
  sourceTopicIds: string[];
  sourceEntryId: string | null;
} {
  const record = requireRecord(payload);
  const sourceTopicIds = requireUuidArray(record, "source_topic_ids", {
    maximum: MAX_BOOK_TOPICS,
  });
  const sourceEntryValue = record.source_entry_id;
  const sourceEntryId = sourceEntryValue === undefined || sourceEntryValue === null
    ? null
    : requireUuid(record, "source_entry_id");
  return {
    id: requireId ? requireUuid(record, "id") : null,
    sealedPayload: requireSealedPayload(record),
    sourceTopicIds: sourceTopicIds ?? [],
    sourceEntryId,
  };
}

async function requireOwnedTopics(
  env: Env,
  userId: string,
  topicIds: string[],
): Promise<void> {
  if (topicIds.length === 0) return;
  const placeholders = topicIds.map((_, index) => `?${index + 2}`).join(", ");
  const result = await env.DB.prepare(
    `SELECT id
     FROM topics
     WHERE user_id = ?1 AND id IN (${placeholders})`,
  )
    .bind(userId, ...topicIds)
    .all<{ id: string }>();
  if (result.results.length !== topicIds.length) {
    throw new ApiError(422, "topic_not_found", "所选主题不存在或不属于当前账户。");
  }
}

async function requireBookDraft(
  env: Env,
  userId: string,
  sourceEntryId: string | null,
): Promise<void> {
  if (!sourceEntryId) return;
  const entry = await env.DB.prepare(
    `SELECT id
     FROM journal_entries
     WHERE id = ?1 AND user_id = ?2 AND category = 'book'`,
  ).bind(sourceEntryId, userId).first<{ id: string }>();
  if (!entry) {
    throw new ApiError(422, "book_draft_not_found", "来源书稿不存在、不属于当前账户或不是书籍分类。");
  }
}

async function storedBook(env: Env, userId: string, bookId: string): Promise<StoredBookRow> {
  const row = await env.DB.prepare(
    `SELECT id, title, preface, content_snapshot, source_snapshot, source_entry_id,
            encryption_version, created_at
     FROM books
     WHERE id = ?1 AND user_id = ?2`,
  )
    .bind(bookId, userId)
    .first<StoredBookRow>();
  if (!row) {
    throw new ApiError(404, "book_not_found", "没有找到这本书。");
  }
  return row;
}

export async function listBooks(env: Env, userId: string): Promise<BookRecord[]> {
  const result = await env.DB.prepare(
    `SELECT id, title, preface, content_snapshot, source_snapshot, source_entry_id,
            encryption_version, created_at
     FROM books
     WHERE user_id = ?1
     ORDER BY created_at DESC`,
  )
    .bind(userId)
    .all<StoredBookRow>();
  return result.results.map(toBookRecord);
}

export async function getBook(
  env: Env,
  userId: string,
  bookId: string,
): Promise<BookRecord> {
  return toBookRecord(await storedBook(env, userId, bookId));
}

export async function createBook(
  env: Env,
  userId: string,
  payload: unknown,
): Promise<BookRecord> {
  await requirePrivacyProfile(env, userId);
  const { id, sealedPayload, sourceTopicIds, sourceEntryId } = validateBookPayload(payload, true);
  const bookId = id as string;
  await requireOwnedTopics(env, userId, sourceTopicIds);
  await requireBookDraft(env, userId, sourceEntryId);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO books
       (id, user_id, title, preface, content_snapshot, source_snapshot,
        source_entry_id, encryption_version, created_at)
     VALUES (?1, ?2, ?3, '', ?4, ?5, ?6, ?7, ?8)`,
  )
    .bind(
      bookId,
      userId,
      ENCRYPTED_CONTENT_LABEL,
      serializeSealedPayload(sealedPayload),
      JSON.stringify({ topic_ids: sourceTopicIds }),
      sourceEntryId,
      CLIENT_ENCRYPTION_VERSION,
      now,
    )
    .run();
  return getBook(env, userId, bookId);
}

export async function updateBook(
  env: Env,
  userId: string,
  bookId: string,
  payload: unknown,
): Promise<BookRecord> {
  await requirePrivacyProfile(env, userId);
  await storedBook(env, userId, bookId);
  const { sealedPayload, sourceTopicIds, sourceEntryId } = validateBookPayload(payload, false);
  await requireOwnedTopics(env, userId, sourceTopicIds);
  await requireBookDraft(env, userId, sourceEntryId);
  const result = await env.DB.prepare(
    `UPDATE books
     SET title = ?1, preface = '', content_snapshot = ?2, source_snapshot = ?3,
         source_entry_id = ?4, encryption_version = ?5
     WHERE id = ?6 AND user_id = ?7`,
  )
    .bind(
      ENCRYPTED_CONTENT_LABEL,
      serializeSealedPayload(sealedPayload),
      JSON.stringify({ topic_ids: sourceTopicIds }),
      sourceEntryId,
      CLIENT_ENCRYPTION_VERSION,
      bookId,
      userId,
    )
    .run();
  if (result.meta.changes !== 1) {
    throw new ApiError(404, "book_not_found", "没有找到这本书。");
  }
  return getBook(env, userId, bookId);
}

export async function deleteBook(
  env: Env,
  userId: string,
  bookId: string,
): Promise<void> {
  const result = await env.DB.prepare(
    "DELETE FROM books WHERE id = ?1 AND user_id = ?2",
  )
    .bind(bookId, userId)
    .run();
  if (result.meta.changes < 1) {
    throw new ApiError(404, "book_not_found", "没有找到这本书。");
  }
}

export async function exportBooks(env: Env, userId: string): Promise<BookRecord[]> {
  const result = await env.DB.prepare(
    `SELECT id, title, preface, content_snapshot, source_snapshot, source_entry_id,
            encryption_version, created_at
     FROM books
     WHERE user_id = ?1
     ORDER BY created_at ASC`,
  )
    .bind(userId)
    .all<StoredBookRow>();
  return result.results.map(toBookRecord);
}
