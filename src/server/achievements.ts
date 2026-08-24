import { ApiError, requireRecord, requireString } from "./http";

export const ACHIEVEMENT_KEYS = [
  "arrival",
  "first_page",
  "first_journal",
  "first_theme",
  "first_letter",
  "first_book",
  "thousand_marks",
  "journey_complete",
] as const;

export type AchievementKey = (typeof ACHIEVEMENT_KEYS)[number];

export interface AchievementRecord {
  key: AchievementKey;
  unlocked_at: string;
}

function requireAchievementKey(payload: unknown): AchievementKey {
  const value = requireString(requireRecord(payload), "key");
  if (!ACHIEVEMENT_KEYS.includes(value as AchievementKey)) {
    throw new ApiError(422, "invalid_achievement", "小彩蛋里没有这项里程碑。");
  }
  return value as AchievementKey;
}

export async function listAchievements(
  env: Env,
  userId: string,
): Promise<AchievementRecord[]> {
  const result = await env.DB.prepare(
    `SELECT achievement_key AS key, unlocked_at
     FROM achievements
     WHERE user_id = ?1
     ORDER BY unlocked_at ASC`,
  )
    .bind(userId)
    .all<AchievementRecord>();
  return result.results;
}

export async function unlockAchievement(
  env: Env,
  userId: string,
  payload: unknown,
): Promise<AchievementRecord> {
  const key = requireAchievementKey(payload);
  const unlockedAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO achievements (user_id, achievement_key, unlocked_at)
     VALUES (?1, ?2, ?3)`,
  )
    .bind(userId, key, unlockedAt)
    .run();
  const achievement = await env.DB.prepare(
    `SELECT achievement_key AS key, unlocked_at
     FROM achievements
     WHERE user_id = ?1 AND achievement_key = ?2`,
  )
    .bind(userId, key)
    .first<AchievementRecord>();
  if (!achievement) {
    throw new ApiError(500, "achievement_not_saved", "里程碑暂时没有存好，请稍后重试。");
  }
  return achievement;
}
