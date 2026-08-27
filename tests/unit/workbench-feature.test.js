import test from "node:test";
import assert from "node:assert/strict";

import {
  entriesForBrowse,
  normalizedTags,
} from "../../src/client/app/workbench-feature.js";

const papers = [
  { id: "loose", category: null, tags: ["学术"] },
  { id: "fragment", category: "fragment", tags: ["学术", "伊萨卡手记"] },
  { id: "theme", category: "theme", tags: ["伊萨卡手记"] },
  { id: "letter", category: "letter", tags: [] },
  { id: "book", category: "book", tags: ["学术"] },
  { id: "journal", category: "journal", tags: ["日常"] },
];

test("unclassified is a null category view rather than a tag or sixth category", () => {
  assert.deepEqual(
    entriesForBrowse(papers, { mode: "category", category: null, tag: null }).map(({ id }) => id),
    ["loose"],
  );
  assert.deepEqual(
    entriesForBrowse(papers, { mode: "category", category: "fragment", tag: null }).map(({ id }) => id),
    ["fragment"],
  );
  assert.deepEqual(
    entriesForBrowse(papers, { mode: "category", category: "journal", tag: null }).map(({ id }) => id),
    ["journal"],
  );
});

test("tag browsing crosses paper categories", () => {
  assert.deepEqual(
    entriesForBrowse(papers, { mode: "tag", category: "fragment", tag: "学术" }).map(({ id }) => id),
    ["loose", "fragment", "book"],
  );
});

test("tag input is trimmed, deduplicated, and accepts Chinese punctuation", () => {
  assert.deepEqual(normalizedTags(" 学术，伊萨卡手记, 学术、研究 "), ["学术", "伊萨卡手记", "研究"]);
});
