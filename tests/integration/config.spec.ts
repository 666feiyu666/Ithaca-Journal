import { describe, expect, it } from "vitest";

import { JOURNEY_TOTAL_DAYS } from "../../src/server/config/journey";
import {
  LETTERS,
  assertLetterCatalog,
  type LetterCatalog,
} from "../../src/server/content/letters";
import { REFLECTION_PROMPTS } from "../../src/server/content/reflection-prompts";

describe("journey content configuration", () => {
  it("contains one complete letter and reflection prompt for every journey day", () => {
    expect(Object.keys(LETTERS)).toHaveLength(JOURNEY_TOTAL_DAYS);
    expect(Object.keys(REFLECTION_PROMPTS)).toHaveLength(JOURNEY_TOTAL_DAYS);

    for (let day = 1; day <= JOURNEY_TOTAL_DAYS; day += 1) {
      expect(LETTERS[day]?.title.trim()).toBeTruthy();
      expect(LETTERS[day]?.sender.trim()).toBeTruthy();
      expect(LETTERS[day]?.content.trim()).toBeTruthy();
      expect(REFLECTION_PROMPTS[day]?.trim()).toBeTruthy();
    }
  });

  it("rejects a letter catalog with a missing day", () => {
    const incomplete = { ...LETTERS } as Record<number, (typeof LETTERS)[number]>;
    delete incomplete[JOURNEY_TOTAL_DAYS];

    expect(() => assertLetterCatalog(incomplete as LetterCatalog)).toThrow(
      `信件配置应包含 ${JOURNEY_TOTAL_DAYS} 天`,
    );
  });
});
