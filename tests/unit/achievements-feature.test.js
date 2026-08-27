import test from "node:test";
import assert from "node:assert/strict";

import {
  createAchievementsFeature,
  reachedAchievementKeys,
  totalWrittenCharacters,
} from "../../src/client/app/achievements-feature.js";
import { createAppState } from "../../src/client/app/state.js";

function createElement() {
  return {
    children: [],
    className: "",
    dataset: {},
    hidden: false,
    textContent: "",
    addEventListener() {},
    append(...children) { this.children.push(...children); },
    replaceChildren() { this.children = []; },
    setAttribute() {},
  };
}

function createFeatureHarness(t, api) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = { createElement };
  globalThis.window = {
    clearTimeout() {},
    requestAnimationFrame(callback) { callback(); },
    setTimeout() { return 1; },
  };
  t.after(() => {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  });

  const state = createAppState();
  state.user = { email: "writer@example.test", source: "development" };
  state.entries = [{ category: "fragment", body: "一页" }];
  const refs = {
    achievementList: createElement(),
    achievementProgress: createElement(),
    achievementToast: { dataset: {}, hidden: true },
    achievementToastTitle: createElement(),
    titleEasterEggButton: createElement(),
  };
  const feature = createAchievementsFeature({
    state,
    refs,
    api,
    vault: {},
    setBusy() {},
    handleError: (error) => { throw error; },
  });
  return { feature, refs, state };
}

test("achievement progress is derived from decrypted user-owned archive data", () => {
  const archive = {
    journey: { status: "active" },
    entries: [
      { category: "journal", body: "今天写日记" },
      { category: "fragment", body: "a".repeat(995) },
    ],
    topics: [{}],
    sent_letters: [],
    books: [],
  };

  assert.equal(totalWrittenCharacters(archive.entries), 1_000);
  assert.deepEqual(reachedAchievementKeys(archive), [
    "first_page",
    "first_journal",
    "first_theme",
    "thousand_marks",
  ]);
});

test("sent letters and immutable snapshots unlock their own tool milestones", () => {
  const keys = reachedAchievementKeys({
    journey: { status: "completed" },
    entries: [],
    topics: [],
    sent_letters: [{}],
    books: [{}],
  });
  assert.deepEqual(keys, ["first_letter", "first_book"]);
});

test("an achievement already stored by the server is not announced again", async (t) => {
  const calls = [];
  const { feature, refs } = createFeatureHarness(t, async (path, options = {}) => {
    calls.push({ path, options });
    assert.equal(path, "/api/achievements");
    assert.equal(options.method, "POST");
    return {
      achievement: { key: "first_page", unlocked_at: "2026-08-24T00:00:00.000Z" },
      created: false,
    };
  });

  await feature.syncFromState();
  await feature.syncFromState();

  assert.equal(calls.length, 1);
  assert.equal(refs.achievementToast.hidden, true);
  assert.equal(refs.achievementProgress.textContent, "1 / 6 已解锁");
});

test("only the first server-created transition is announced", async (t) => {
  const calls = [];
  const { feature, refs } = createFeatureHarness(t, async (path, options = {}) => {
    calls.push({ path, options });
    return {
      achievement: { key: "first_page", unlocked_at: "2026-08-24T00:00:00.000Z" },
      created: true,
    };
  });

  await feature.syncFromState();
  await feature.syncFromState();

  assert.equal(calls.length, 1);
  assert.equal(refs.achievementToast.hidden, false);
  assert.equal(refs.achievementToastTitle.textContent, "留下一页");
});
