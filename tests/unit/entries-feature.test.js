import test from "node:test";
import assert from "node:assert/strict";

import { createEntriesFeature } from "../../src/client/app/entries-feature.js";
import { createAppState } from "../../src/client/app/state.js";

function createClassList() {
  const values = new Set();
  return {
    contains: (value) => values.has(value),
    toggle(value, force) {
      if (force) values.add(value);
      else values.delete(value);
    },
  };
}

function createHarness() {
  const state = createAppState();
  const messages = [];
  const savedEvents = [];
  const apiCalls = [];
  const plaintextById = new Map();
  const refs = {
    editorEmpty: { hidden: false },
    editorPanel: {
      hidden: true,
      classList: createClassList(),
      parentElement: { scrollTop: 12 },
    },
    entryTitle: { value: "", focus() {}, addEventListener() {} },
    entryCategory: { value: "fragment", addEventListener() {} },
    entryTags: { value: "", addEventListener() {} },
    entryRecipient: { value: "", focus() {}, addEventListener() {} },
    entryRecipientField: { hidden: true },
    entryKindLabel: { textContent: "" },
    entryContextAction: { textContent: "", hidden: true, addEventListener() {} },
    entryBody: {
      value: "",
      focused: false,
      focus() { this.focused = true; },
      addEventListener() {},
    },
    entryDate: { textContent: "" },
    saveState: { textContent: "", dataset: {} },
    characterCount: { textContent: "" },
    saveButton: { textContent: "", addEventListener() {} },
    expandEditorButton: {
      textContent: "",
      setAttribute() {},
      addEventListener() {},
    },
    deleteEntryButton: { addEventListener() {} },
    confirmDeleteEntry: { addEventListener() {} },
    deleteEntryDialog: { showModal() {} },
    exportButton: { addEventListener() {} },
  };
  refs.editorPanel.addEventListener = () => {};

  const api = async (path, options = {}) => {
    apiCalls.push({ path, options });
    if (path === "/api/entries" && options.method === "POST") {
      const request = JSON.parse(options.body);
      return {
        entry: {
          id: request.id,
          encryption_version: 1,
          sealed_payload: request.sealed_payload,
          category: request.category,
          source_topic_id: request.source_topic_id,
          source_letter_day: request.source_letter_day,
          updated_at: "2026-08-21T12:00:00.000Z",
        },
      };
    }
    if (path === "/api/entries") {
      const id = [...plaintextById.keys()][0];
      return {
        entries: [{
          id,
          encryption_version: 1,
          sealed_payload: {
            version: 1,
            iv: "AAAAAAAAAAAAAAAA",
            ciphertext: "A".repeat(22),
          },
          category: "fragment",
          source_topic_id: null,
          source_letter_day: null,
          updated_at: "2026-08-21T12:00:00.000Z",
        }],
      };
    }
    throw new Error(`Unexpected API call: ${path}`);
  };

  const vault = {
    async seal(kind, id, value) {
      assert.equal(kind, "entry");
      plaintextById.set(id, value);
      return {
        version: 1,
        iv: "AAAAAAAAAAAAAAAA",
        ciphertext: "A".repeat(22),
      };
    },
    async openEntry(record) {
      const content = plaintextById.get(record.id);
      return {
        ...record,
        ...content,
        excerpt: content.body.slice(0, 180),
        body_format: "plain",
      };
    },
  };

  const feature = createEntriesFeature({
    state,
    refs,
    api,
    vault,
    exportPlaintext: async () => {},
    setBusy: (busy) => { state.busy = busy; },
    updateActions() {},
    renderList() {},
    showEmptyEditor() {},
    showMessage: (message, type) => messages.push({ message, type }),
    handleError: (error) => { throw error; },
    onSaved: (info) => savedEvents.push(info),
  });

  return { apiCalls, feature, messages, refs, savedEvents, state };
}

test("new fragments begin as a compact, clean memo focused on the body", () => {
  const { feature, refs, state } = createHarness();

  feature.beginNewEntry();

  assert.equal(state.current.id, null);
  assert.equal(state.dirty, false);
  assert.equal(state.editorExpanded, false);
  assert.equal(refs.editorPanel.classList.contains("editor-panel--expanded"), false);
  assert.equal(refs.entryBody.focused, true);
  assert.equal(refs.saveButton.textContent, "保存纸页");
});

test("an empty paper cannot be saved", async () => {
  const { apiCalls, feature, messages, refs } = createHarness();
  feature.beginNewEntry();

  await feature.saveCurrentEntry();

  assert.equal(apiCalls.length, 0);
  assert.equal(refs.saveState.dataset.state, "error");
  assert.equal(messages.at(-1).type, "error");
});

test("saving a new paper reloads summaries and emits the drawer event", async () => {
  const { apiCalls, feature, refs, savedEvents, state } = createHarness();
  feature.beginNewEntry();
  refs.entryTitle.value = "海边的风";
  refs.entryBody.value = "风从港口吹过来。";
  state.dirty = true;

  await feature.saveCurrentEntry();

  assert.deepEqual(apiCalls.map(({ path }) => path), ["/api/entries", "/api/entries"]);
  assert.match(state.current.id, /^[0-9a-f-]{36}$/u);
  assert.equal(state.entries[0].excerpt, "风从港口吹过来。");
  assert.equal(apiCalls[0].options.body.includes("海边的风"), false);
  assert.equal(apiCalls[0].options.body.includes("风从港口吹过来"), false);
  assert.equal(state.dirty, false);
  assert.equal(refs.saveButton.textContent, "保存修改");
  assert.equal(savedEvents.length, 1);
  assert.equal(savedEvents[0].created, true);
  assert.equal(JSON.parse(apiCalls[0].options.body).category, "fragment");
});
