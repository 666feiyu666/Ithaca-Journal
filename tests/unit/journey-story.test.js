import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { parseTwee } from "../../scripts/lib/twee-parser.mjs";

const storySourceUrl = new URL("../../narrative/journey/story.zh-CN.twee", import.meta.url);

test("the Journey author source forms one reachable, two-layer story", async () => {
  const story = parseTwee(await readFile(storySourceUrl, "utf8"));

  assert.equal(story.start, "PROLOGUE_S01");
  assert.equal(story.passageOrder.length, 47);
  assert.deepEqual(story.endingIds, ["CH04_END"]);
  assert.equal(story.passages.PROLOGUE_S01.layer, "reality");
  assert.equal(story.passages.PROLOGUE_DRAFT_01.layer, "design");
  assert.match(
    story.passages.PROLOGUE_DRAFT_01.paragraphs.join("\n"),
    /不是卡夫卡租住的房间/,
  );
  assert.match(story.passages.CH04_END.paragraphs.at(-1), /无疾而终/);
});

test("every publishable passage must identify its narrative layer", async () => {
  const source = await readFile(storySourceUrl, "utf8");
  const missingLayer = source.replace(
    ":: PROLOGUE_S01 [prologue layer-reality",
    ":: PROLOGUE_S01 [prologue",
  );

  assert.throws(() => parseTwee(missingLayer), /叙事层级标签/);
});
