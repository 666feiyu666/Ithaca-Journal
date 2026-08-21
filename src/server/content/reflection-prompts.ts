import { JOURNEY_TOTAL_DAYS } from "../config/journey";

export const DEFAULT_REFLECTION_PROMPT = "你有什么想说的吗？";

export const REFLECTION_PROMPTS: Readonly<Record<number, string>> = Object.freeze(
  Object.fromEntries(
    Array.from({ length: JOURNEY_TOTAL_DAYS }, (_, index) => [
      index + 1,
      DEFAULT_REFLECTION_PROMPT,
    ]),
  ) as Record<number, string>,
);
