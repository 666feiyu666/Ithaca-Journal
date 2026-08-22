import { ApiError, requireRecord } from "./http";

interface PuzzleDefinition {
  id: string;
  title: string;
  description: string;
  piece_count: number;
}

interface TopicPuzzleContext {
  active_puzzle_id: string | null;
  fragment_count: number;
}

export interface PuzzleShopItem extends PuzzleDefinition {
  owned: boolean;
  active: boolean;
  eligible: boolean;
  remaining_fragments: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PUZZLE_CATALOG: readonly PuzzleDefinition[] = Object.freeze([
  Object.freeze({
    id: "sunset-grid-12",
    title: "落日方格 · 十二片",
    description: "四乘三的经典拼合，把十二则散页收进同一幅轮廓。",
    piece_count: 12,
  }),
]);

function puzzleById(puzzleId: string): PuzzleDefinition {
  const puzzle = PUZZLE_CATALOG.find(({ id }) => id === puzzleId);
  if (!puzzle) {
    throw new ApiError(404, "puzzle_not_found", "没有找到这套拼图。");
  }
  return puzzle;
}

function requireTopicId(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new ApiError(422, "invalid_topic_id", "主题标识无效。");
  }
  return value;
}

async function requireTopicPuzzleContext(
  env: Env,
  userId: string,
  topicId: string,
): Promise<TopicPuzzleContext> {
  const context = await env.DB.prepare(
    `SELECT topics.active_puzzle_id,
            COUNT(topic_fragments.fragment_id) AS fragment_count
     FROM topics
     LEFT JOIN topic_fragments ON topic_fragments.topic_id = topics.id
     WHERE topics.id = ?1 AND topics.user_id = ?2
     GROUP BY topics.id`,
  )
    .bind(topicId, userId)
    .first<TopicPuzzleContext>();
  if (!context) {
    throw new ApiError(404, "topic_not_found", "没有找到这则主题笔记。");
  }
  return context;
}

async function ownedPuzzleIds(env: Env, userId: string): Promise<Set<string>> {
  const result = await env.DB.prepare(
    `SELECT puzzle_id
     FROM user_puzzles
     WHERE user_id = ?1
     ORDER BY purchased_at ASC`,
  )
    .bind(userId)
    .all<{ puzzle_id: string }>();
  return new Set(result.results.map(({ puzzle_id }) => puzzle_id));
}

export async function listPuzzleShop(
  env: Env,
  userId: string,
  topicId: string,
): Promise<PuzzleShopItem[]> {
  requireTopicId(topicId);
  const [context, owned] = await Promise.all([
    requireTopicPuzzleContext(env, userId, topicId),
    ownedPuzzleIds(env, userId),
  ]);
  return PUZZLE_CATALOG.map((puzzle) => ({
    ...puzzle,
    owned: owned.has(puzzle.id),
    active: context.active_puzzle_id === puzzle.id,
    eligible: context.fragment_count >= puzzle.piece_count,
    remaining_fragments: Math.max(0, puzzle.piece_count - context.fragment_count),
  }));
}

async function equipPuzzle(
  env: Env,
  userId: string,
  topicId: string,
  puzzle: PuzzleDefinition | null,
): Promise<void> {
  const now = new Date().toISOString();
  const statements = [
    env.DB.prepare(
      `UPDATE topics
       SET active_puzzle_id = ?1, updated_at = ?2
       WHERE id = ?3 AND user_id = ?4`,
    ).bind(puzzle?.id ?? null, now, topicId, userId),
  ];
  if (puzzle) {
    statements.push(
      env.DB.prepare(
        `UPDATE topic_fragments
         SET shape_variant = position % ?1
         WHERE topic_id = ?2`,
      ).bind(puzzle.piece_count, topicId),
    );
  }
  await env.DB.batch(statements);
}

export async function purchasePuzzle(
  env: Env,
  userId: string,
  puzzleId: string,
  payload: unknown,
): Promise<void> {
  const puzzle = puzzleById(puzzleId);
  const record = requireRecord(payload);
  const topicId = requireTopicId(record.topic_id);

  const [context, owned] = await Promise.all([
    requireTopicPuzzleContext(env, userId, topicId),
    ownedPuzzleIds(env, userId),
  ]);
  if (!owned.has(puzzle.id) && context.fragment_count < puzzle.piece_count) {
    throw new ApiError(
      422,
      "puzzle_requirement_not_met",
      `还需要 ${puzzle.piece_count - context.fragment_count} 则碎片笔记才能兑换。`,
    );
  }

  const statements = [];
  if (!owned.has(puzzle.id)) {
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO user_puzzles
           (user_id, puzzle_id, purchased_at, source_topic_id)
         VALUES (?1, ?2, ?3, ?4)`,
      ).bind(userId, puzzle.id, new Date().toISOString(), topicId),
    );
  }
  if (statements.length) {
    await env.DB.batch(statements);
  }
  await equipPuzzle(env, userId, topicId, puzzle);
}

export async function setTopicPuzzle(
  env: Env,
  userId: string,
  topicId: string,
  payload: unknown,
): Promise<void> {
  const record = requireRecord(payload);
  const puzzleId = record.puzzle_id;
  await requireTopicPuzzleContext(env, userId, topicId);
  if (puzzleId === null) {
    await equipPuzzle(env, userId, topicId, null);
    return;
  }
  if (typeof puzzleId !== "string") {
    throw new ApiError(422, "invalid_puzzle_id", "拼图标识无效。");
  }
  const puzzle = puzzleById(puzzleId);
  const owned = await ownedPuzzleIds(env, userId);
  if (!owned.has(puzzle.id)) {
    throw new ApiError(403, "puzzle_not_owned", "请先在拼图商店兑换这套拼图。");
  }
  await equipPuzzle(env, userId, topicId, puzzle);
}

export async function exportOwnedPuzzles(
  env: Env,
  userId: string,
): Promise<Array<{ puzzle_id: string; purchased_at: string; source_topic_id: string | null }>> {
  const result = await env.DB.prepare(
    `SELECT puzzle_id, purchased_at, source_topic_id
     FROM user_puzzles
     WHERE user_id = ?1
     ORDER BY purchased_at ASC`,
  )
    .bind(userId)
    .all<{ puzzle_id: string; purchased_at: string; source_topic_id: string | null }>();
  return result.results;
}
