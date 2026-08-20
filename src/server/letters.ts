import { ApiError } from "./http";
import { getJourney } from "./journey";
import { LETTERS, type LetterContent } from "./letters-data.js";

interface OpenedLetterRow {
  day: number;
  opened_at: string;
}

export interface LetterSummary {
  day: number;
  title: string;
  sender: string;
  opened_at: string | null;
  current: boolean;
}

export interface LetterDetail extends LetterContent {
  day: number;
  opened_at: string;
}

async function requireJourneyDay(env: Env, userId: string): Promise<number> {
  const journey = await getJourney(env, userId);
  if (!journey || !journey.intro_completed_at) {
    throw new ApiError(404, "journey_not_ready", "完成序章后才会收到来信。");
  }
  return journey.current_day;
}

function requireLetter(day: number): LetterContent {
  const letter = LETTERS[day];
  if (!Number.isInteger(day) || day < 1 || day > 21 || !letter) {
    throw new ApiError(404, "letter_not_found", "没有找到这封信。");
  }
  return letter;
}

export async function listAvailableLetters(
  env: Env,
  userId: string,
): Promise<LetterSummary[]> {
  const currentDay = await requireJourneyDay(env, userId);
  const opened = await env.DB.prepare(
    `SELECT day, opened_at
     FROM journey_letters
     WHERE user_id = ?1 AND day <= ?2`,
  )
    .bind(userId, currentDay)
    .all<OpenedLetterRow>();
  const openedByDay = new Map(opened.results.map((row) => [row.day, row.opened_at]));

  return Array.from({ length: currentDay }, (_, index) => {
    const day = index + 1;
    const letter = requireLetter(day);
    return {
      day,
      title: letter.title,
      sender: letter.sender,
      opened_at: openedByDay.get(day) ?? null,
      current: day === currentDay,
    };
  });
}

export async function openLetter(
  env: Env,
  userId: string,
  day: number,
): Promise<LetterDetail> {
  const currentDay = await requireJourneyDay(env, userId);
  const letter = requireLetter(day);
  if (day > currentDay) {
    throw new ApiError(403, "letter_locked", "这封信还没有送达。");
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO journey_letters (user_id, day, opened_at)
     VALUES (?1, ?2, ?3)`,
  )
    .bind(userId, day, now)
    .run();
  const opened = await env.DB.prepare(
    `SELECT day, opened_at
     FROM journey_letters
     WHERE user_id = ?1 AND day = ?2`,
  )
    .bind(userId, day)
    .first<OpenedLetterRow>();
  if (!opened) {
    throw new ApiError(500, "letter_not_opened", "无法保存来信阅读状态。");
  }
  return { day, ...letter, opened_at: opened.opened_at };
}
