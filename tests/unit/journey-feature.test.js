import test from "node:test";
import assert from "node:assert/strict";

import { createJourneyFeature } from "../../src/client/app/journey-feature.js";
import { createAppState } from "../../src/client/app/state.js";

function createElement() {
  const listeners = new Map();
  return {
    children: [],
    className: "",
    dataset: {},
    disabled: false,
    hidden: false,
    textContent: "",
    type: "",
    addEventListener(type, listener) {
      const current = listeners.get(type) ?? [];
      current.push(listener);
      listeners.set(type, current);
    },
    click() {
      for (const listener of listeners.get("click") ?? []) listener({ currentTarget: this });
    },
    replaceChildren(...children) {
      this.children = children;
    },
  };
}

function nextTurn() {
  return new Promise((resolve) => setImmediate(resolve));
}

test("Journey renders Twee passages and persists a declared choice", async (t) => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement };
  t.after(() => { globalThis.document = previousDocument; });

  const state = createAppState();
  state.user = { email: "reader@example.test", source: "development" };
  const refs = {
    accessRetry: createElement(),
    journeyAction: createElement(),
    toolsetAction: createElement(),
    journeyReturnTitleButton: createElement(),
    journeyPassageLabel: createElement(),
    journeyLayerLabel: createElement(),
    storyStage: createElement(),
    storyHeading: createElement(),
    storyDialogue: createElement(),
    storySpeaker: createElement(),
    storyCopy: createElement(),
    storyChoices: createElement(),
  };
  const apiCalls = [];
  const presented = [];
  const feature = createJourneyFeature({
    state,
    refs,
    api: async (path, options = {}) => {
      apiCalls.push({ path, options });
      if (options.method === "POST") {
        return {
          story_journey: { status: "active", current_passage: "PROLOGUE_S01" },
        };
      }
      if (options.method === "PUT") {
        const { passage } = JSON.parse(options.body);
        return { story_journey: { status: "active", current_passage: passage } };
      }
      throw new Error(`Unexpected request: ${path}`);
    },
    setBusy: (busy) => { state.busy = busy; },
    showAuth() {},
    showTitle() {},
    showScene() {},
    showJourney: (journey) => { presented.push(journey.current_passage); },
    ensurePrivacy: async () => {},
    handleError: (error) => { throw error; },
  });

  feature.bindEvents();
  refs.journeyAction.click();
  await nextTurn();

  assert.equal(refs.journeyPassageLabel.textContent, "序章");
  assert.equal(refs.journeyLayerLabel.textContent, "现实");
  assert.equal(refs.storyHeading.textContent, "陌生城市与设计稿");
  assert.match(refs.storyCopy.children[0].textContent, /陌生的城市/);
  assert.equal(refs.storyChoices.children[0].textContent, "继续");

  refs.storyChoices.children[0].click();
  await nextTurn();

  assert.equal(apiCalls[1].path, "/api/story-journey");
  assert.equal(apiCalls[1].options.method, "PUT");
  assert.deepEqual(JSON.parse(apiCalls[1].options.body), { passage: "PROLOGUE_S02" });
  assert.equal(state.storyJourney.current_passage, "PROLOGUE_S02");
  assert.deepEqual(presented, ["PROLOGUE_S01", "PROLOGUE_S02"]);

  feature.renderPassage({ status: "active", current_passage: "PROLOGUE_DRAFT_01" });
  assert.equal(refs.storyStage.dataset.storyLayer, "design");
  assert.equal(refs.journeyLayerLabel.textContent, "《伊萨卡手记》设计稿");
  assert.match(refs.storyCopy.children[2].textContent, /不是卡夫卡租住的房间/);
});
