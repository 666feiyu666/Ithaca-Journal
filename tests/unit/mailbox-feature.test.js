import test from "node:test";
import assert from "node:assert/strict";

import { createMailboxFeature } from "../../src/client/app/mailbox-feature.js";
import { createAppState } from "../../src/client/app/state.js";

function createElement() {
  const listeners = new Map();
  return {
    attributes: {},
    children: [],
    dataset: {},
    disabled: false,
    focused: false,
    hidden: false,
    open: false,
    textContent: "",
    value: "",
    addEventListener(type, handler) {
      const handlers = listeners.get(type) ?? [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    append(...children) { this.children.push(...children); },
    close() { this.open = false; },
    dispatch(type, event = {}) {
      const dispatched = { preventDefault() {}, ...event };
      for (const handler of listeners.get(type) ?? []) handler(dispatched);
    },
    focus() { this.focused = true; },
    replaceChildren() { this.children = []; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    showModal() { this.open = true; },
  };
}

function settle() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createHarness(t) {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement };
  t.after(() => { globalThis.document = previousDocument; });

  const state = createAppState();
  state.user = { email: "writer@example.test" };
  const refs = {
    writeLetterButton: createElement(),
    inboxTab: createElement(),
    sentTab: createElement(),
    mailList: createElement(),
    mailListEmpty: createElement(),
    mailEmpty: createElement(),
    mailReader: createElement(),
    mailReaderMeta: createElement(),
    mailReaderTitle: createElement(),
    mailReaderParty: createElement(),
    mailReaderContent: createElement(),
    mailReaderAction: createElement(),
    editSentLetterButton: createElement(),
    deleteSentLetterButton: createElement(),
    editSentLetterDialog: createElement(),
    editSentLetterForm: createElement(),
    editSentLetterTitle: createElement(),
    editSentLetterRecipient: createElement(),
    editSentLetterBody: createElement(),
    editSentLetterError: createElement(),
    cancelEditSentLetter: createElement(),
    saveSentLetter: createElement(),
    deleteSentLetterDialog: createElement(),
    confirmDeleteSentLetter: createElement(),
  };
  const id = "37c02640-0897-4f56-a510-5cfdf64df8e7";
  const sentAt = "2026-08-24T19:23:00.000Z";
  const plaintext = new Map([[id, {
    title: "原来的记录",
    recipient: "Cheeno",
    body: "原来的正文",
  }]]);
  const storedLetter = {
    id,
    source_entry_id: "997b5366-d8ab-4bfb-9ac8-240a7f001902",
    encryption_version: 1,
    sealed_payload: { version: 1, iv: "AAAAAAAAAAAAAAAA", ciphertext: "A".repeat(22) },
    sent_at: sentAt,
  };
  const apiCalls = [];
  const api = async (path, options = {}) => {
    apiCalls.push({ path, options });
    if (path === "/api/letters") return { letters: [] };
    if (path === "/api/sent-letters") return { letters: [storedLetter] };
    if (path === `/api/sent-letters/${id}` && options.method === "PUT") {
      return {
        letter: {
          ...storedLetter,
          sealed_payload: JSON.parse(options.body).sealed_payload,
        },
      };
    }
    if (path === `/api/sent-letters/${id}` && options.method === "DELETE") return null;
    throw new Error(`Unexpected API call: ${path}`);
  };
  const messages = [];
  const vault = {
    async openSentLetter(record) {
      return { ...record, ...plaintext.get(record.id) };
    },
    async seal(kind, recordId, value) {
      assert.equal(kind, "sent-letter");
      assert.equal(recordId, id);
      plaintext.set(recordId, value);
      return { version: 1, iv: "BBBBBBBBBBBBBBBB", ciphertext: "B".repeat(22) };
    },
  };
  const feature = createMailboxFeature({
    state,
    refs,
    api,
    vault,
    setBusy: (busy) => { state.busy = busy; },
    showMailboxView() {},
    openDesk: async () => {},
    showMessage: (message) => messages.push(message),
    handleError: (error) => { throw error; },
    canLeaveCurrentDraft: () => true,
  });
  feature.bindEvents();
  return { apiCalls, feature, id, messages, refs, sentAt, state };
}

test("a symbolically sent letter can be corrected without changing its send time", async (t) => {
  const { apiCalls, feature, id, messages, refs, sentAt, state } = createHarness(t);
  await feature.open({ mode: "sent", letterId: id });

  assert.equal(refs.editSentLetterButton.hidden, false);
  assert.equal(refs.deleteSentLetterButton.hidden, false);
  refs.editSentLetterButton.dispatch("click");
  assert.equal(refs.editSentLetterDialog.open, true);
  refs.editSentLetterTitle.value = "修正后的记录";
  refs.editSentLetterRecipient.value = "Professor Cheeno";
  refs.editSentLetterBody.value = "现实中寄出的是这一版。";
  refs.editSentLetterForm.dispatch("submit");
  await settle();

  const update = apiCalls.find(({ options }) => options.method === "PUT");
  assert.equal(update.path, `/api/sent-letters/${id}`);
  assert.equal(update.options.body.includes("现实中寄出的是这一版"), false);
  assert.equal(state.currentSentLetter.title, "修正后的记录");
  assert.equal(state.currentSentLetter.sent_at, sentAt);
  assert.equal(refs.editSentLetterDialog.open, false);
  assert.equal(messages.at(-1), "寄件记录已经更新。");
});

test("deleting a sent record removes only that mailbox item", async (t) => {
  const { apiCalls, feature, id, messages, refs, state } = createHarness(t);
  await feature.open({ mode: "sent", letterId: id });

  refs.deleteSentLetterButton.dispatch("click");
  assert.equal(refs.deleteSentLetterDialog.open, true);
  refs.confirmDeleteSentLetter.dispatch("click");
  await settle();

  assert.equal(apiCalls.some(({ path, options }) => (
    path === `/api/sent-letters/${id}` && options.method === "DELETE"
  )), true);
  assert.deepEqual(state.sentLetters, []);
  assert.equal(state.currentSentLetter, null);
  assert.equal(refs.mailReader.hidden, true);
  assert.equal(refs.mailEmpty.hidden, false);
  assert.equal(messages.at(-1), "寄件记录已经删除，现实中的寄送不会受到影响。");
});
