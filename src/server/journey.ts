import { ApiError, requireRecord, requireString } from "./http";
import { JOURNEY_TOTAL_DAYS } from "./config/journey";

export interface JourneyRow {
  status: "active" | "completed";
  current_day: number;
  started_at: string;
  last_entered_at: string;
  last_progress_date: string;
  intro_completed_at: string | null;
  completed_at: string | null;
}

function requireLocalDate(payload: unknown): string {
  const record = requireRecord(payload);
  const value = requireString(record, "local_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(422, "invalid_local_date", "本地日期格式无效。");
  }

  const [year, month, day] = value.split("-").map(Number);
  const normalized = new Date(Date.UTC(year!, month! - 1, day!))
    .toISOString()
    .slice(0, 10);
  if (normalized !== value) {
    throw new ApiError(422, "invalid_local_date", "本地日期无效。");
  }
  return value;
}

export async function getJourney(
  env: Env,
  userId: string,
): Promise<JourneyRow | null> {
  return env.DB.prepare(
    `SELECT status, current_day, started_at, last_entered_at,
            last_progress_date, intro_completed_at, completed_at
     FROM journeys
     WHERE user_id = ?1`,
  )
    .bind(userId)
    .first<JourneyRow>();
}

export async function enterJourney(
  env: Env,
  userId: string,
  payload: unknown,
): Promise<{ journey: JourneyRow; created: boolean }> {
  const localDate = requireLocalDate(payload);
  const now = new Date().toISOString();
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO journeys
       (user_id, status, current_day, started_at, last_entered_at, last_progress_date)
     VALUES (?1, 'active', 1, ?2, ?2, ?3)`,
  )
    .bind(userId, now, localDate)
    .run();

  await env.DB.prepare(
    `UPDATE journeys
     SET current_day = CASE
           WHEN current_day < ?4 THEN current_day + 1
           ELSE current_day
         END,
         status = CASE
           WHEN current_day + 1 >= ?4 THEN 'completed'
           ELSE status
         END,
         completed_at = CASE
           WHEN current_day + 1 >= ?4 THEN COALESCE(completed_at, ?2)
           ELSE completed_at
         END,
         last_progress_date = ?1,
         last_entered_at = ?2
     WHERE user_id = ?3 AND last_progress_date < ?1`,
  )
    .bind(localDate, now, userId, JOURNEY_TOTAL_DAYS)
    .run();

  await env.DB.prepare(
    `UPDATE journeys
     SET last_entered_at = ?1
     WHERE user_id = ?2`,
  )
    .bind(now, userId)
    .run();

  const journey = await getJourney(env, userId);
  if (!journey) {
    throw new ApiError(500, "journey_not_created", "无法建立旅程存档。");
  }
  return { journey, created: inserted.meta.changes === 1 };
}

export async function completeIntro(
  env: Env,
  userId: string,
): Promise<JourneyRow> {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE journeys
     SET intro_completed_at = COALESCE(intro_completed_at, ?1),
         last_entered_at = ?1
     WHERE user_id = ?2`,
  )
    .bind(now, userId)
    .run();
  if (result.meta.changes !== 1) {
    throw new ApiError(404, "journey_not_found", "还没有开始旅程。");
  }

  const journey = await getJourney(env, userId);
  if (!journey) {
    throw new ApiError(404, "journey_not_found", "还没有开始旅程。");
  }
  return journey;
}
