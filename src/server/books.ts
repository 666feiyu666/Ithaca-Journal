import { ApiError, requireRecord, requireString } from "./http";
import { getTopic, type TopicDetail } from "./topics";

interface BookRow {
  id: string;
  title: string;
  preface: string;
  content_snapshot: string;
  source_snapshot: string;
  created_at: string;
}

interface BookSummaryRow {
  id: string;
  title: string;
  created_at: string;
}

interface BookSourceSnapshot {
  topic_id: string;
  title: string;
  updated_at: string;
  fragment_ids: string[];
}

export interface BookDetail extends Omit<BookRow, "source_snapshot"> {
  sources: BookSourceSnapshot[];
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BOOK_CHARACTERS = 500_000;

function validateBookPayload(payload: unknown): {
  title: string;
  preface: string;
  topicIds: string[];
} {
  const record = requireRecord(payload);
  const title = requireString(record, "title").trim();
  const prefaceValue = record.preface ?? "";
  const topicIdsValue = record.topic_ids;

  if (!title) {
    throw new ApiError(422, "book_title_required", "请为这本书命名。");
  }
  if (title.length > 120) {
    throw new ApiError(422, "title_too_long", "书名不能超过 120 个字符。");
  }
  if (typeof prefaceValue !== "string") {
    throw new ApiError(422, "invalid_payload", "preface 必须是文本。");
  }
  if (prefaceValue.length > 20_000) {
    throw new ApiError(413, "preface_too_large", "序言超过当前版本的大小限制。");
  }
  if (!Array.isArray(topicIdsValue) || topicIdsValue.length === 0) {
    throw new ApiError(422, "topics_required", "请至少选择一则主题笔记。");
  }
  if (topicIdsValue.length > 20) {
    throw new ApiError(422, "too_many_topics", "一本书最多收录 20 则主题笔记。");
  }
  if (!topicIdsValue.every((id) => typeof id === "string" && UUID_PATTERN.test(id))) {
    throw new ApiError(422, "invalid_topic_ids", "主题笔记标识无效。");
  }

  return {
    title,
    preface: prefaceValue,
    topicIds: [...new Set(topicIdsValue)],
  };
}

function renderBook(title: string, preface: string, topics: TopicDetail[]): string {
  const sections = topics.map((topic) => {
    const fragments = topic.fragments
      .map((fragment) => `### 素材｜${fragment.title}\n\n${fragment.body}`)
      .join("\n\n");
    return [`## ${topic.title}`, topic.body, fragments].filter(Boolean).join("\n\n");
  });
  return [`# ${title}`, preface, ...sections].filter(Boolean).join("\n\n---\n\n");
}

function toBookDetail(row: BookRow): BookDetail {
  let sources: BookSourceSnapshot[];
  try {
    sources = JSON.parse(row.source_snapshot) as BookSourceSnapshot[];
  } catch {
    throw new ApiError(500, "invalid_book_snapshot", "这本书的来源快照无法读取。");
  }
  const { source_snapshot: _sourceSnapshot, ...book } = row;
  return { ...book, sources };
}

export async function listBooks(env: Env, userId: string): Promise<BookSummaryRow[]> {
  const result = await env.DB.prepare(
    `SELECT id, title, created_at
     FROM books
     WHERE user_id = ?1
     ORDER BY created_at DESC`,
  )
    .bind(userId)
    .all<BookSummaryRow>();
  return result.results;
}

export async function getBook(
  env: Env,
  userId: string,
  bookId: string,
): Promise<BookDetail> {
  const row = await env.DB.prepare(
    `SELECT id, title, preface, content_snapshot, source_snapshot, created_at
     FROM books
     WHERE id = ?1 AND user_id = ?2`,
  )
    .bind(bookId, userId)
    .first<BookRow>();
  if (!row) {
    throw new ApiError(404, "book_not_found", "没有找到这本书。");
  }
  return toBookDetail(row);
}

export async function compileBook(
  env: Env,
  userId: string,
  payload: unknown,
): Promise<BookDetail> {
  const { title, preface, topicIds } = validateBookPayload(payload);
  const topics = await Promise.all(topicIds.map((topicId) => getTopic(env, userId, topicId)));
  const contentSnapshot = renderBook(title, preface, topics);
  if (contentSnapshot.length > MAX_BOOK_CHARACTERS) {
    throw new ApiError(413, "book_too_large", "编纂结果超过当前版本的大小限制。");
  }

  const sourceSnapshot: BookSourceSnapshot[] = topics.map((topic) => ({
    topic_id: topic.id,
    title: topic.title,
    updated_at: topic.updated_at,
    fragment_ids: topic.fragments.map((fragment) => fragment.id),
  }));
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO books
       (id, user_id, title, preface, content_snapshot, source_snapshot, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  )
    .bind(id, userId, title, preface, contentSnapshot, JSON.stringify(sourceSnapshot), now)
    .run();
  return getBook(env, userId, id);
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

export async function exportBooks(env: Env, userId: string): Promise<BookDetail[]> {
  const result = await env.DB.prepare(
    `SELECT id, title, preface, content_snapshot, source_snapshot, created_at
     FROM books
     WHERE user_id = ?1
     ORDER BY created_at ASC`,
  )
    .bind(userId)
    .all<BookRow>();
  return result.results.map(toBookDetail);
}
