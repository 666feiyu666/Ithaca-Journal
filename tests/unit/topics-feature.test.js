import test from "node:test";
import assert from "node:assert/strict";

import { createAppState } from "../../src/client/app/state.js";
import {
  createTopicsFeature,
  setTopicDragAvailability,
} from "../../src/client/app/topics-feature.js";

test("a piece rebuilt during layout saving becomes draggable again afterwards", () => {
  const piece = { draggable: true };
  const root = {
    querySelectorAll(selector) {
      assert.equal(selector, ".topic-piece");
      return [piece];
    },
  };

  setTopicDragAvailability(root, true);
  assert.equal(piece.draggable, false);

  setTopicDragAvailability(root, false);
  assert.equal(piece.draggable, true);
});

test("an empty fragment drawer does not block creation of a topic draft", () => {
  const state = createAppState();
  const refs = {
    topicFormError: { textContent: "", hidden: false },
    topicDialogTitle: { textContent: "" },
    topicId: { value: "" },
    topicTitleInput: { value: "", focused: false, focus() { this.focused = true; } },
    topicBodyInput: { value: "" },
    saveTopic: { textContent: "" },
    topicDialog: { opened: false, showModal() { this.opened = true; } },
  };
  const feature = createTopicsFeature({
    state,
    refs,
    api: async () => { throw new Error("not used"); },
    setBusy() {},
    renderList() {},
    showEmptyEditor() {},
    showMessage() {},
    handleError: (error) => { throw error; },
    canLeaveCurrentDraft: () => true,
  });

  feature.openTopicDialog();

  assert.equal(refs.topicDialog.opened, true);
  assert.equal(refs.topicTitleInput.focused, true);
  assert.equal(refs.saveTopic.textContent, "创建并进入画布");
  assert.match(refs.topicDialogTitle.textContent, /主题/);
});
