import { ApiError, requireRecord } from "./http";
import { requirePrivacyProfile } from "./privacy";
import {
  CLIENT_ENCRYPTION_VERSION,
  ENCRYPTED_CONTENT_LABEL,
  parseStoredSealedPayload,
  requireSealedPayload,
  requireUuid,
  serializeSealedPayload,
  type SealedPayload,
} from "./sealed";

interface StoredSentLetterRow {
  id: string;
  source_entry_id: string | null;
  content_snapshot: string;
  encryption_version: number;
  sent_at: string;
}

export interface SentLetterRecord {
  id: string;
  source_entry_id: string | null;
  encryption_version: 1;
  sealed_payload: SealedPayload;
  sent_at: string;
}

function toSentLetterRecord(row: StoredSentLetterRow): SentLetterRecord {
  if (row.encryption_version !== CLIENT_ENCRYPTION_VERSION) {
    throw new ApiError(500, "unsupported_stored_encryption", "保存的寄件加密版本无法读取。");
  }
  return {
    id: row.id,
    source_entry_id: row.source_entry_id,
    encryption_version: CLIENT_ENCRYPTION_VERSION,
    sealed_payload: parseStoredSealedPayload(row.content_snapshot),
    sent_at: row.sent_at,
  };
}

async function requireLetterDraft(
  env: Env,
  userId: string,
  sourceEntryId: string | null,
): Promise<void> {
  if (!sourceEntryId) return;
  const entry = await env.DB.prepare(
    `SELECT id
     FROM journal_entries
     WHERE id = ?1 AND user_id = ?2 AND category = 'letter'`,
  ).bind(sourceEntryId, userId).first<{ id: string }>();
  if (!entry) {
    throw new ApiError(422, "letter_draft_not_found", "来源草稿不存在、不属于当前账户或不是书信分类。");
  }
}

async function storedSentLetter(
  env: Env,
  userId: string,
  letterId: string,
): Promise<StoredSentLetterRow> {
  const row = await env.DB.prepare(
    `SELECT id, source_entry_id, content_snapshot, encryption_version, sent_at
     FROM sent_letters
     WHERE id = ?1 AND user_id = ?2`,
  ).bind(letterId, userId).first<StoredSentLetterRow>();
  if (!row) {
    throw new ApiError(404, "sent_letter_not_found", "没有找到这封寄件。");
  }
  return row;
}

export async function listSentLetters(
  env: Env,
  userId: string,
): Promise<SentLetterRecord[]> {
  const result = await env.DB.prepare(
    `SELECT id, source_entry_id, content_snapshot, encryption_version, sent_at
     FROM sent_letters
     WHERE user_id = ?1
     ORDER BY sent_at DESC`,
  ).bind(userId).all<StoredSentLetterRow>();
  return result.results.map(toSentLetterRecord);
}

export async function getSentLetter(
  env: Env,
  userId: string,
  letterId: string,
): Promise<SentLetterRecord> {
  return toSentLetterRecord(await storedSentLetter(env, userId, letterId));
}

export async function createSentLetter(
  env: Env,
  userId: string,
  payload: unknown,
): Promise<SentLetterRecord> {
  await requirePrivacyProfile(env, userId);
  const record = requireRecord(payload);
  const id = requireUuid(record, "id");
  const sealedPayload = requireSealedPayload(record);
  const sourceEntryId = record.source_entry_id === undefined || record.source_entry_id === null
    ? null
    : requireUuid(record, "source_entry_id");
  await requireLetterDraft(env, userId, sourceEntryId);
  const sentAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO sent_letters
       (id, user_id, source_entry_id, title, content_snapshot, encryption_version, sent_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  ).bind(
    id,
    userId,
    sourceEntryId,
    ENCRYPTED_CONTENT_LABEL,
    serializeSealedPayload(sealedPayload),
    CLIENT_ENCRYPTION_VERSION,
    sentAt,
  ).run();
  return getSentLetter(env, userId, id);
}

export async function updateSentLetter(
  env: Env,
  userId: string,
  letterId: string,
  payload: unknown,
): Promise<SentLetterRecord> {
  await requirePrivacyProfile(env, userId);
  const sealedPayload = requireSealedPayload(requireRecord(payload));
  const result = await env.DB.prepare(
    `UPDATE sent_letters
     SET title = ?1, content_snapshot = ?2, encryption_version = ?3
     WHERE id = ?4 AND user_id = ?5`,
  ).bind(
    ENCRYPTED_CONTENT_LABEL,
    serializeSealedPayload(sealedPayload),
    CLIENT_ENCRYPTION_VERSION,
    letterId,
    userId,
  ).run();
  if (result.meta.changes !== 1) {
    throw new ApiError(404, "sent_letter_not_found", "没有找到这封寄件。");
  }
  return getSentLetter(env, userId, letterId);
}

export async function deleteSentLetter(
  env: Env,
  userId: string,
  letterId: string,
): Promise<void> {
  const result = await env.DB.prepare(
    "DELETE FROM sent_letters WHERE id = ?1 AND user_id = ?2",
  ).bind(letterId, userId).run();
  if (result.meta.changes < 1) {
    throw new ApiError(404, "sent_letter_not_found", "没有找到这封寄件。");
  }
}

export async function exportSentLetters(
  env: Env,
  userId: string,
): Promise<SentLetterRecord[]> {
  const result = await env.DB.prepare(
    `SELECT id, source_entry_id, content_snapshot, encryption_version, sent_at
     FROM sent_letters
     WHERE user_id = ?1
     ORDER BY sent_at ASC`,
  ).bind(userId).all<StoredSentLetterRow>();
  return result.results.map(toSentLetterRecord);
}
