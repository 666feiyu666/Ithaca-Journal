import { ApiError, requireRecord, requireString } from "./http";

interface EntrySummaryRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface EntryRow extends EntrySummaryRow {
  body: string;
  body_format: string;
  encryption_version: number;
}

function validateEntryPayload(payload: unknown): { title: string; body: string } {
  const record = requireRecord(payload);
  const rawTitle = requireString(record, "title").trim();
  const body = requireString(record, "body");
  const title = rawTitle || "未命名碎片";

  if (title.length > 120) {
    throw new ApiError(422, "title_too_long", "标题不能超过 120 个字符。");
  }
  if (body.length > 100_000) {
    throw new ApiError(413, "entry_too_large", "碎片正文超过当前版本的大小限制。");
  }
  return { title, body };
}

export async function listEntries(
  env: Env,
  userId: string,
): Promise<EntrySummaryRow[]> {
  const result = await env.DB.prepare(
    `SELECT id, title, created_at, updated_at
     FROM journal_entries
     WHERE user_id = ?1
     ORDER BY updated_at DESC`,
  )
    .bind(userId)
    .all<EntrySummaryRow>();
  return result.results;
}

export async function getEntry(
  env: Env,
  userId: string,
  entryId: string,
): Promise<EntryRow> {
  const entry = await env.DB.prepare(
    `SELECT id, title, body, body_format, encryption_version, created_at, updated_at
     FROM journal_entries
     WHERE id = ?1 AND user_id = ?2`,
  )
    .bind(entryId, userId)
    .first<EntryRow>();
  if (!entry) {
    throw new ApiError(404, "entry_not_found", "没有找到这则碎片笔记。");
  }
  return entry;
}

export async function createEntry(
  env: Env,
  userId: string,
  payload: unknown,
): Promise<EntryRow> {
  const { title, body } = validateEntryPayload(payload);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO journal_entries
       (id, user_id, title, body, body_format, encryption_version, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, 'plain', 0, ?5, ?5)`,
  )
    .bind(id, userId, title, body, now)
    .run();
  return getEntry(env, userId, id);
}

export async function updateEntry(
  env: Env,
  userId: string,
  entryId: string,
  payload: unknown,
): Promise<EntryRow> {
  const { title, body } = validateEntryPayload(payload);
  const result = await env.DB.prepare(
    `UPDATE journal_entries
     SET title = ?1, body = ?2, updated_at = ?3
     WHERE id = ?4 AND user_id = ?5`,
  )
    .bind(title, body, new Date().toISOString(), entryId, userId)
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

export async function exportEntries(
  env: Env,
  userId: string,
): Promise<EntryRow[]> {
  const result = await env.DB.prepare(
    `SELECT id, title, body, body_format, encryption_version, created_at, updated_at
     FROM journal_entries
     WHERE user_id = ?1
     ORDER BY created_at ASC`,
  )
    .bind(userId)
    .all<EntryRow>();
  return result.results;
}
