import { ApiError, requireRecord, requireString } from "./http";

interface TopicSummaryRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  fragment_count: number;
  active_puzzle_id: string | null;
}

interface TopicRow {
  id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  layout_version: number;
  pattern_seed: string;
  active_puzzle_id: string | null;
}

export interface TopicFragmentRow {
  id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  position: number;
  canvas_x: number;
  canvas_y: number;
  z_index: number;
  shape_variant: number;
  is_snapped: number;
}

export interface TopicDetail extends TopicRow {
  fragments: TopicFragmentRow[];
}

interface TopicPayload {
  title: string;
  body: string;
  fragmentIds: string[] | null;
}

interface TopicLayoutItem {
  fragmentId: string;
  canvasX: number;
  canvasY: number;
  zIndex: number;
  shapeVariant: number;
  isSnapped: boolean;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TOPIC_FRAGMENTS = 50;
const PUZZLE_SLOT_COUNT = 50;

function validateTopicPayload(payload: unknown): TopicPayload {
  const record = requireRecord(payload);
  const rawTitle = requireString(record, "title").trim();
  const body = requireString(record, "body");
  const fragmentIdsValue = record.fragment_ids;

  if (!rawTitle) {
    throw new ApiError(422, "topic_title_required", "请为主题命名。");
  }
  if (rawTitle.length > 120) {
    throw new ApiError(422, "title_too_long", "主题标题不能超过 120 个字符。");
  }
  if (body.length > 100_000) {
    throw new ApiError(413, "topic_too_large", "主题笔记超过当前版本的大小限制。");
  }
  if (fragmentIdsValue !== undefined && !Array.isArray(fragmentIdsValue)) {
    throw new ApiError(422, "invalid_fragment_ids", "fragment_ids 必须是数组。");
  }
  if (Array.isArray(fragmentIdsValue) && fragmentIdsValue.length > MAX_TOPIC_FRAGMENTS) {
    throw new ApiError(422, "too_many_fragments", "一个主题最多整理 50 则碎片笔记。");
  }
  if (
    Array.isArray(fragmentIdsValue)
    && !fragmentIdsValue.every((id) => typeof id === "string" && UUID_PATTERN.test(id))
  ) {
    throw new ApiError(422, "invalid_fragment_ids", "碎片笔记标识无效。");
  }

  return {
    title: rawTitle,
    body,
    fragmentIds: Array.isArray(fragmentIdsValue)
      ? [...new Set(fragmentIdsValue as string[])]
      : null,
  };
}

function validateTopicLayout(payload: unknown): TopicLayoutItem[] {
  const record = requireRecord(payload);
  const itemsValue = record.items;
  if (!Array.isArray(itemsValue)) {
    throw new ApiError(422, "invalid_layout", "items 必须是数组。");
  }
  if (itemsValue.length > MAX_TOPIC_FRAGMENTS) {
    throw new ApiError(422, "too_many_fragments", "一个主题最多整理 50 则碎片笔记。");
  }

  const items = itemsValue.map((value): TopicLayoutItem => {
    const item = requireRecord(value);
    const fragmentId = item.fragment_id;
    const canvasX = item.canvas_x;
    const canvasY = item.canvas_y;
    const zIndex = item.z_index;
    const shapeVariant = item.shape_variant;
    const isSnapped = item.is_snapped;

    if (typeof fragmentId !== "string" || !UUID_PATTERN.test(fragmentId)) {
      throw new ApiError(422, "invalid_fragment_ids", "碎片笔记标识无效。");
    }
    if (
      typeof canvasX !== "number"
      || !Number.isFinite(canvasX)
      || canvasX < 0
      || canvasX > 1
      || typeof canvasY !== "number"
      || !Number.isFinite(canvasY)
      || canvasY < 0
      || canvasY > 1
    ) {
      throw new ApiError(422, "invalid_layout_position", "画布坐标必须在 0 到 1 之间。");
    }
    if (
      typeof zIndex !== "number"
      || !Number.isInteger(zIndex)
      || zIndex < 0
      || zIndex > 10_000
    ) {
      throw new ApiError(422, "invalid_z_index", "碎片层级无效。");
    }
    if (
      typeof shapeVariant !== "number"
      || !Number.isInteger(shapeVariant)
      || shapeVariant < 0
      || shapeVariant >= PUZZLE_SLOT_COUNT
    ) {
      throw new ApiError(422, "invalid_shape_variant", "拼图形态必须在 0 到 49 之间。");
    }
    if (isSnapped !== undefined && typeof isSnapped !== "boolean") {
      throw new ApiError(422, "invalid_snap_state", "拼图吸附状态无效。");
    }
    return {
      fragmentId,
      canvasX,
      canvasY,
      zIndex,
      shapeVariant,
      isSnapped: isSnapped === true,
    };
  });

  if (new Set(items.map((item) => item.fragmentId)).size !== items.length) {
    throw new ApiError(422, "duplicate_fragments", "同一主题中不能重复放入同一则碎片。");
  }
  return items;
}

async function requireOwnedFragments(
  env: Env,
  userId: string,
  fragmentIds: string[],
): Promise<void> {
  if (fragmentIds.length === 0) {
    return;
  }
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
            topics.active_puzzle_id,
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
    `SELECT id, title, body, created_at, updated_at, layout_version, pattern_seed,
            active_puzzle_id
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
            topic_fragments.position, topic_fragments.canvas_x,
            topic_fragments.canvas_y, topic_fragments.z_index,
            topic_fragments.shape_variant, topic_fragments.is_snapped
     FROM topic_fragments
     JOIN journal_entries ON journal_entries.id = topic_fragments.fragment_id
     WHERE topic_fragments.topic_id = ?1 AND journal_entries.user_id = ?2
     ORDER BY topic_fragments.z_index ASC, topic_fragments.position ASC`,
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
  const initialFragmentIds = fragmentIds ?? [];
  await requireOwnedFragments(env, userId, initialFragmentIds);
  const id = crypto.randomUUID();
  const patternSeed = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO topics
         (id, user_id, title, body, created_at, updated_at, layout_version, pattern_seed)
       VALUES (?1, ?2, ?3, ?4, ?5, ?5, 1, ?6)`,
    ).bind(id, userId, title, body, now, patternSeed),
    ...initialFragmentIds.map((fragmentId, position) =>
      env.DB.prepare(
        `INSERT INTO topic_fragments
           (topic_id, fragment_id, position, canvas_x, canvas_y, z_index, shape_variant, is_snapped)
         VALUES (?1, ?2, ?3, ?4, ?5, ?3, ?6, 0)`,
      ).bind(
        id,
        fragmentId,
        position,
        0.06 + ((position % 4) * 0.30),
        0.08 + (Math.floor(position / 4) * 0.07),
        position % PUZZLE_SLOT_COUNT,
      ),
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
  if (fragmentIds !== null) {
    await requireOwnedFragments(env, userId, fragmentIds);
  }
  const now = new Date().toISOString();
  const statements = [
    env.DB.prepare(
      `UPDATE topics
       SET title = ?1, body = ?2, updated_at = ?3
       WHERE id = ?4 AND user_id = ?5`,
    ).bind(title, body, now, topicId, userId),
  ];
  if (fragmentIds !== null) {
    statements.push(
      env.DB.prepare("DELETE FROM topic_fragments WHERE topic_id = ?1").bind(topicId),
      ...fragmentIds.map((fragmentId, position) =>
        env.DB.prepare(
          `INSERT INTO topic_fragments
             (topic_id, fragment_id, position, canvas_x, canvas_y, z_index, shape_variant, is_snapped)
           VALUES (?1, ?2, ?3, ?4, ?5, ?3, ?6, 0)`,
        ).bind(
          topicId,
          fragmentId,
          position,
          0.06 + ((position % 4) * 0.30),
          0.08 + (Math.floor(position / 4) * 0.07),
          position % PUZZLE_SLOT_COUNT,
        ),
      ),
    );
  }
  await env.DB.batch(statements);
  return getTopic(env, userId, topicId);
}

export async function updateTopicLayout(
  env: Env,
  userId: string,
  topicId: string,
  payload: unknown,
): Promise<TopicDetail> {
  await getTopic(env, userId, topicId);
  const items = validateTopicLayout(payload);
  await requireOwnedFragments(env, userId, items.map((item) => item.fragmentId));
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM topic_fragments WHERE topic_id = ?1").bind(topicId),
    ...items.map((item, position) =>
      env.DB.prepare(
        `INSERT INTO topic_fragments
           (topic_id, fragment_id, position, canvas_x, canvas_y, z_index, shape_variant, is_snapped)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      ).bind(
        topicId,
        item.fragmentId,
        position,
        item.canvasX,
        item.canvasY,
        item.zIndex,
        item.shapeVariant,
        item.isSnapped ? 1 : 0,
      ),
    ),
    env.DB.prepare(
      `UPDATE topics
       SET updated_at = ?1, layout_version = layout_version + 1
       WHERE id = ?2 AND user_id = ?3`,
    ).bind(now, topicId, userId),
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
