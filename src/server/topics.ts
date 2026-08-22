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

interface StoredTopicRow {
  id: string;
  title: string;
  body: string;
  encryption_version: number;
  created_at: string;
  updated_at: string;
  layout_version: number;
  pattern_seed: string;
  active_puzzle_id: string | null;
}

interface StoredTopicSummaryRow extends StoredTopicRow {
  fragment_count: number;
}

interface StoredTopicFragmentRow {
  id: string;
  title: string;
  body: string;
  body_format: string;
  encryption_version: number;
  created_at: string;
  updated_at: string;
  position: number;
  canvas_x: number;
  canvas_y: number;
  z_index: number;
  shape_variant: number;
  is_snapped: number;
}

interface TopicMetadata {
  id: string;
  encryption_version: number;
  created_at: string;
  updated_at: string;
  layout_version: number;
  pattern_seed: string;
  active_puzzle_id: string | null;
}

export interface LegacyTopicRecord extends TopicMetadata {
  encryption_version: 0;
  title: string;
  body: string;
}

export interface EncryptedTopicRecord extends TopicMetadata {
  encryption_version: 1;
  sealed_payload: SealedPayload;
}

export type TopicRecord = LegacyTopicRecord | EncryptedTopicRecord;

interface FragmentLayout {
  position: number;
  canvas_x: number;
  canvas_y: number;
  z_index: number;
  shape_variant: number;
  is_snapped: number;
}

export type TopicFragmentRecord = (
  | {
    id: string;
    encryption_version: 0;
    title: string;
    body: string;
    excerpt: string;
    body_format: string;
    created_at: string;
    updated_at: string;
  }
  | {
    id: string;
    encryption_version: 1;
    sealed_payload: SealedPayload;
    created_at: string;
    updated_at: string;
  }
) & FragmentLayout;

export type TopicSummaryRecord = TopicRecord & { fragment_count: number };
export type TopicDetail = TopicRecord & { fragments: TopicFragmentRecord[] };

interface TopicLayoutItem {
  fragmentId: string;
  canvasX: number;
  canvasY: number;
  zIndex: number;
  shapeVariant: number;
  isSnapped: boolean;
}

const MAX_TOPIC_FRAGMENTS = 50;
const PUZZLE_SLOT_COUNT = 50;

function toTopicRecord(row: StoredTopicRow): TopicRecord {
  const metadata = {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    layout_version: row.layout_version,
    pattern_seed: row.pattern_seed,
    active_puzzle_id: row.active_puzzle_id,
  };
  if (row.encryption_version === CLIENT_ENCRYPTION_VERSION) {
    return {
      ...metadata,
      encryption_version: CLIENT_ENCRYPTION_VERSION,
      sealed_payload: parseStoredSealedPayload(row.body),
    };
  }
  if (row.encryption_version !== 0) {
    throw new ApiError(500, "unsupported_stored_encryption", "保存的主题加密版本无法读取。");
  }
  return {
    ...metadata,
    encryption_version: 0,
    title: row.title,
    body: row.body,
  };
}

function toTopicSummary(row: StoredTopicSummaryRow): TopicSummaryRecord {
  return { ...toTopicRecord(row), fragment_count: row.fragment_count };
}

function toTopicFragment(row: StoredTopicFragmentRow): TopicFragmentRecord {
  const metadata = {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    position: row.position,
    canvas_x: row.canvas_x,
    canvas_y: row.canvas_y,
    z_index: row.z_index,
    shape_variant: row.shape_variant,
    is_snapped: row.is_snapped,
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

function validateTopicPayload(payload: unknown, requireId: boolean): {
  id: string | null;
  sealedPayload: SealedPayload;
  fragmentIds: string[] | null;
} {
  const record = requireRecord(payload);
  return {
    id: requireId ? requireUuid(record, "id") : null,
    sealedPayload: requireSealedPayload(record),
    fragmentIds: requireUuidArray(record, "fragment_ids", { maximum: MAX_TOPIC_FRAGMENTS }),
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
    const fragmentId = requireUuid(item, "fragment_id");
    const canvasX = item.canvas_x;
    const canvasY = item.canvas_y;
    const zIndex = item.z_index;
    const shapeVariant = item.shape_variant;
    const isSnapped = item.is_snapped;

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

export async function listTopics(env: Env, userId: string): Promise<TopicSummaryRecord[]> {
  const result = await env.DB.prepare(
    `SELECT topics.id, topics.title, topics.body, topics.encryption_version,
            topics.created_at, topics.updated_at, topics.layout_version,
            topics.pattern_seed, topics.active_puzzle_id,
            COUNT(topic_fragments.fragment_id) AS fragment_count
     FROM topics
     LEFT JOIN topic_fragments ON topic_fragments.topic_id = topics.id
     WHERE topics.user_id = ?1
     GROUP BY topics.id
     ORDER BY topics.updated_at DESC`,
  )
    .bind(userId)
    .all<StoredTopicSummaryRow>();
  return result.results.map(toTopicSummary);
}

export async function getTopic(
  env: Env,
  userId: string,
  topicId: string,
): Promise<TopicDetail> {
  const topic = await env.DB.prepare(
    `SELECT id, title, body, encryption_version, created_at, updated_at,
            layout_version, pattern_seed, active_puzzle_id
     FROM topics
     WHERE id = ?1 AND user_id = ?2`,
  )
    .bind(topicId, userId)
    .first<StoredTopicRow>();
  if (!topic) {
    throw new ApiError(404, "topic_not_found", "没有找到这则主题笔记。");
  }

  const fragments = await env.DB.prepare(
    `SELECT journal_entries.id, journal_entries.title, journal_entries.body,
            journal_entries.body_format, journal_entries.encryption_version,
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
    .all<StoredTopicFragmentRow>();

  return { ...toTopicRecord(topic), fragments: fragments.results.map(toTopicFragment) };
}

export async function createTopic(
  env: Env,
  userId: string,
  payload: unknown,
): Promise<TopicDetail> {
  await requirePrivacyProfile(env, userId);
  const { id, sealedPayload, fragmentIds } = validateTopicPayload(payload, true);
  const topicId = id as string;
  const initialFragmentIds = fragmentIds ?? [];
  await requireOwnedFragments(env, userId, initialFragmentIds);
  const patternSeed = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO topics
         (id, user_id, title, body, encryption_version, created_at, updated_at,
          layout_version, pattern_seed)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, 1, ?7)`,
    ).bind(
      topicId,
      userId,
      ENCRYPTED_CONTENT_LABEL,
      serializeSealedPayload(sealedPayload),
      CLIENT_ENCRYPTION_VERSION,
      now,
      patternSeed,
    ),
    ...initialFragmentIds.map((fragmentId, position) =>
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
  ]);
  return getTopic(env, userId, topicId);
}

export async function updateTopic(
  env: Env,
  userId: string,
  topicId: string,
  payload: unknown,
): Promise<TopicDetail> {
  await requirePrivacyProfile(env, userId);
  await getTopic(env, userId, topicId);
  const { sealedPayload, fragmentIds } = validateTopicPayload(payload, false);
  if (fragmentIds !== null) {
    await requireOwnedFragments(env, userId, fragmentIds);
  }
  const now = new Date().toISOString();
  const statements = [
    env.DB.prepare(
      `UPDATE topics
       SET title = ?1, body = ?2, encryption_version = ?3, updated_at = ?4
       WHERE id = ?5 AND user_id = ?6`,
    ).bind(
      ENCRYPTED_CONTENT_LABEL,
      serializeSealedPayload(sealedPayload),
      CLIENT_ENCRYPTION_VERSION,
      now,
      topicId,
      userId,
    ),
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
