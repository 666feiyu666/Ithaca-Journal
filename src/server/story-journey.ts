import {
  JOURNEY_STORY_ENDINGS,
  JOURNEY_STORY_PASSAGE_IDS,
  JOURNEY_STORY_START,
  JOURNEY_STORY_TRANSITIONS,
} from "./generated/journey-story";
import { ApiError, requireRecord, requireString } from "./http";

export interface StoryJourneyRow {
  status: "active" | "completed";
  current_passage: string;
  started_at: string;
  last_entered_at: string;
  completed_at: string | null;
}

function normalizeStoryJourney(row: StoryJourneyRow): StoryJourneyRow {
  if (JOURNEY_STORY_PASSAGE_IDS.has(row.current_passage)) {
    return row;
  }
  return { ...row, current_passage: JOURNEY_STORY_START };
}

async function getStoredStoryJourney(
  env: Env,
  userId: string,
): Promise<StoryJourneyRow | null> {
  return env.DB.prepare(
    `SELECT status, current_passage, started_at, last_entered_at, completed_at
     FROM story_journeys
     WHERE user_id = ?1`,
  )
    .bind(userId)
    .first<StoryJourneyRow>();
}

export async function getStoryJourney(
  env: Env,
  userId: string,
): Promise<StoryJourneyRow | null> {
  const row = await getStoredStoryJourney(env, userId);
  return row ? normalizeStoryJourney(row) : null;
}

export async function enterStoryJourney(
  env: Env,
  userId: string,
): Promise<{ storyJourney: StoryJourneyRow; created: boolean }> {
  const now = new Date().toISOString();
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO story_journeys
       (user_id, status, current_passage, started_at, last_entered_at)
     VALUES (?1, 'active', ?2, ?3, ?3)`,
  )
    .bind(userId, JOURNEY_STORY_START, now)
    .run();

  const stored = await getStoredStoryJourney(env, userId);
  if (!stored) {
    throw new ApiError(500, "story_journey_not_created", "无法建立视觉小说存档。");
  }

  const currentPassage = normalizeStoryJourney(stored).current_passage;
  if (stored.status === "completed") {
    await env.DB.prepare(
      `UPDATE story_journeys
       SET status = 'active', current_passage = ?1, started_at = ?2,
           last_entered_at = ?2, completed_at = NULL
       WHERE user_id = ?3`,
    )
      .bind(JOURNEY_STORY_START, now, userId)
      .run();
  } else {
    await env.DB.prepare(
      `UPDATE story_journeys
       SET current_passage = ?1, last_entered_at = ?2
       WHERE user_id = ?3`,
    )
      .bind(currentPassage, now, userId)
      .run();
  }

  const storyJourney = await getStoryJourney(env, userId);
  if (!storyJourney) {
    throw new ApiError(500, "story_journey_not_created", "无法建立视觉小说存档。");
  }

  return { storyJourney, created: inserted.meta.changes === 1 };
}

export async function advanceStoryJourney(
  env: Env,
  userId: string,
  payload: unknown,
): Promise<StoryJourneyRow> {
  const passage = requireString(requireRecord(payload), "passage").trim();
  if (!JOURNEY_STORY_PASSAGE_IDS.has(passage)) {
    throw new ApiError(422, "unknown_story_passage", "目标剧情段落不存在。");
  }

  const stored = await getStoredStoryJourney(env, userId);
  if (!stored) {
    throw new ApiError(404, "story_journey_not_found", "请先开始这段旅程。");
  }
  if (stored.status === "completed") {
    throw new ApiError(409, "story_journey_completed", "这段旅程已经结束，可以从标题页重访。");
  }

  const currentPassage = normalizeStoryJourney(stored).current_passage;
  const allowedTargets = JOURNEY_STORY_TRANSITIONS[currentPassage] ?? [];
  if (!allowedTargets.includes(passage)) {
    throw new ApiError(409, "invalid_story_transition", "无法从当前段落前往该剧情段落。");
  }

  const now = new Date().toISOString();
  const completed = JOURNEY_STORY_ENDINGS.has(passage);
  await env.DB.prepare(
    `UPDATE story_journeys
     SET status = ?1, current_passage = ?2, last_entered_at = ?3, completed_at = ?4
     WHERE user_id = ?5`,
  )
    .bind(completed ? "completed" : "active", passage, now, completed ? now : null, userId)
    .run();

  const storyJourney = await getStoryJourney(env, userId);
  if (!storyJourney) {
    throw new ApiError(500, "story_journey_not_updated", "无法保存视觉小说进度。");
  }
  return storyJourney;
}
