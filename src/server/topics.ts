import { ApiError, requireRecord, requireString } from "./http";

interface TopicSummaryRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  fragment_count: number;
}

interface TopicRow {
  id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface TopicFragmentRow {
  id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  position: number;
}

export interface TopicDetail extends TopicRow {
  fragments: TopicFragmentRow[];
}

interface TopicPayload {
  title: string;
  body: string;
  fragmentIds: string[];
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateTopicPayload(payload: unknown): TopicPayload {
  const record = requireRecord(payload);
  const rawTitle = requireString(record, "title").trim();
  const body = requireString(record, "body");
  const fragmentIds = record.fragment_ids;

  if (!rawTitle) {
    throw new ApiError(422, "topic_title_required", "请为主题命名。");
  }
  if (rawTitle.length > 120) {
    throw new ApiError(422, "title_too_long", "主题标题不能超过 120 个字符。");
  }
  if (body.length > 100_000) {
    throw new ApiError(413, "topic_too_large", "主题笔记超过当前版本的大小限制。");
  }
  if (!Array.isArray(fragmentIds) || fragmentIds.length === 0) {
    throw new ApiError(422, "fragments_required", "请至少选择一则碎片笔记。");
  }
  if (fragmentIds.length > 50) {
    throw new ApiError(422, "too_many_fragments", "一个主题最多整理 50 则碎片笔记。");
  }
  if (!fragmentIds.every((id) => typeof id === "string" && UUID_PATTERN.test(id))) {
    throw new ApiError(422, "invalid_fragment_ids", "碎片笔记标识无效。");
  }

  return { title: rawTitle, body, fragmentIds: [...new Set(fragmentIds)] };
}

async function requireOwnedFragments(
  env: Env,
  userId: string,
  fragmentIds: string[],
): Promise<void> {
  const placeholders = fragmentIds.map((_, index) => `?${index + 2}`).join(", ");
  const result = await env.DB.prepare(
    `SELECT id
     FROM journal_entries
     WHERE user_id = ?1 AND id IN (${placeholders})`,
  )
    .bind(userId, ...fragmentIds)
    .all<{ id: string }>();

  if (result.results.length !== fragmentIds.length) {
    throw new ApiError(
      422,
      "fragment_not_found",
      "所选碎片中有内容不存在或不属于当前账户。",
    );
  }
}

export async function listTopics(env: Env, userId: string): Promise<TopicSummaryRow[]> {
  const result = await env.DB.prepare(
    `SELECT topics.id, topics.title, topics.created_at, topics.updated_at,
            COUNT(topic_fragments.fragment_id) AS fragment_count
     FROM topics
     LEFT JOIN topic_fragments ON topic_fragments.topic_id = topics.id
     WHERE topics.user_id = ?1
     GROUP BY topics.id
     ORDER BY topics.updated_at DESC`,
  )
    .bind(userId)
    .all<TopicSummaryRow>();
  return result.results;
}

export async function getTopic(
  env: Env,
  userId: string,
  topicId: string,
): Promise<TopicDetail> {
  const topic = await env.DB.prepare(
    `SELECT id, title, body, created_at, updated_at
     FROM topics
     WHERE id = ?1 AND user_id = ?2`,
  )
    .bind(topicId, userId)
    .first<TopicRow>();
  if (!topic) {
    throw new ApiError(404, "topic_not_found", "没有找到这则主题笔记。");
  }

  const fragments = await env.DB.prepare(
    `SELECT journal_entries.id, journal_entries.title, journal_entries.body,
            journal_entries.created_at, journal_entries.updated_at,
            topic_fragments.position
     FROM topic_fragments
     JOIN journal_entries ON journal_entries.id = topic_fragments.fragment_id
     WHERE topic_fragments.topic_id = ?1 AND journal_entries.user_id = ?2
     ORDER BY topic_fragments.position ASC`,
  )
    .bind(topicId, userId)
    .all<TopicFragmentRow>();

  return { ...topic, fragments: fragments.results };
}

export async function createTopic(
  env: Env,
  userId: string,
  payload: unknown,
): Promise<TopicDetail> {
  const { title, body, fragmentIds } = validateTopicPayload(payload);
  await requireOwnedFragments(env, userId, fragmentIds);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO topics (id, user_id, title, body, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?5)`,
    ).bind(id, userId, title, body, now),
    ...fragmentIds.map((fragmentId, position) =>
      env.DB.prepare(
        `INSERT INTO topic_fragments (topic_id, fragment_id, position)
         VALUES (?1, ?2, ?3)`,
      ).bind(id, fragmentId, position),
    ),
  ]);
  return getTopic(env, userId, id);
}

export async function updateTopic(
  env: Env,
  userId: string,
  topicId: string,
  payload: unknown,
): Promise<TopicDetail> {
  await getTopic(env, userId, topicId);
  const { title, body, fragmentIds } = validateTopicPayload(payload);
  await requireOwnedFragments(env, userId, fragmentIds);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE topics
       SET title = ?1, body = ?2, updated_at = ?3
       WHERE id = ?4 AND user_id = ?5`,
    ).bind(title, body, now, topicId, userId),
    env.DB.prepare("DELETE FROM topic_fragments WHERE topic_id = ?1").bind(topicId),
    ...fragmentIds.map((fragmentId, position) =>
      env.DB.prepare(
        `INSERT INTO topic_fragments (topic_id, fragment_id, position)
         VALUES (?1, ?2, ?3)`,
      ).bind(topicId, fragmentId, position),
    ),
  ]);
  return getTopic(env, userId, topicId);
}

export async function deleteTopic(
  env: Env,
  userId: string,
  topicId: string,
): Promise<void> {
  const result = await env.DB.prepare(
    "DELETE FROM topics WHERE id = ?1 AND user_id = ?2",
  )
    .bind(topicId, userId)
    .run();
  if (result.meta.changes < 1) {
    throw new ApiError(404, "topic_not_found", "没有找到这则主题笔记。");
  }
}
