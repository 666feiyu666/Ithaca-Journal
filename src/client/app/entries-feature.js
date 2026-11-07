import { formatDate } from "./format.js";

const CATEGORY_LABELS = Object.freeze({
  "": "未分类",
  fragment: "碎片",
  theme: "主题",
  letter: "书信",
  book: "书籍",
  journal: "日记",
});

const DRAFT_SAVE_DELAY = 500;

function parseTags(value) {
  return [...new Set(String(value ?? "").split(/[，,、]/u).map((tag) => tag.trim()).filter(Boolean))].slice(0, 20);
}

function emptyEntry(category = "fragment", seed = {}) {
  return {
    id: null,
    title: "",
    body: "",
    tags: [],
    category,
    source_topic_id: null,
    source_letter_day: null,
    updated_at: null,
    ...seed,
  };
}

export function createEntriesFeature({
  state,
  refs,
  api,
  vault,
  draft = null,
  exportPlaintext,
  setBusy,
  updateActions,
  renderList,
  showMessage,
  handleError,
  onSaved,
  onContextAction = () => {},
  translate = (value) => value,
}) {
  function updateSaveState(label, status = "saved") {
    refs.saveState.textContent = label;
    refs.saveState.dataset.state = status;
  }

  function updateCharacterCount() {
    refs.characterCount.textContent = `${refs.entryBody.value.length.toLocaleString("zh-CN")} 个字符`;
  }

  function setEditorExpanded(expanded) {
    state.editorExpanded = expanded;
    state.view = expanded ? "page" : "desk";
    refs.editorPanel.classList.toggle("editor-panel--expanded", expanded);
    refs.expandEditorButton.setAttribute("aria-pressed", String(expanded));
    refs.expandEditorButton.textContent = expanded ? "收起纸页" : "展开书写";
    if (expanded && refs.entryDetails) refs.entryDetails.open = true;
  }

  function updateEditorContext() {
    const category = refs.entryCategory.value;
    refs.entryKindLabel.textContent = `${CATEGORY_LABELS[category]}纸页`;
    refs.entryRecipientField.hidden = category !== "letter";
    let action = "";
    if (category === "theme" && state.current?.source_topic_id) action = "查看来源主题板";
    if (category === "letter") action = "寄出这封信";
    if (category === "book") action = "装订并上架";
    refs.entryContextAction.textContent = action;
    refs.entryContextAction.hidden = !action || !state.current?.id;
  }

  function showEditor(entry, { expanded = Boolean(entry.id) } = {}) {
    state.current = {
      category: "fragment",
      tags: [],
      source_topic_id: null,
      source_letter_day: null,
      ...entry,
    };
    state.dirty = false;
    refs.editorPanel.hidden = false;
    refs.entryCategory.value = state.current.category ?? "";
    refs.entryTags.value = (state.current.tags ?? []).join("，");
    refs.entryRecipient.value = state.current.recipient ?? "";
    refs.entryTitle.value = state.current.title ?? "";
    refs.entryBody.value = state.current.body ?? "";
    refs.entryDate.textContent = state.current.created_at
      ? `写于 ${formatDate(state.current.created_at)}`
      : "尚未保存";
    refs.entryEdited.textContent = state.current.updated_at
      ? `最近保存：${formatDate(state.current.updated_at)}`
      : "";
    refs.entryEdited.hidden = !state.current.updated_at;
    refs.saveButton.textContent = "保存纸页";
    setEditorExpanded(expanded);
    updateSaveState(state.current.updated_at ? "已保存" : "尚未保存", "saved");
    updateCharacterCount();
    updateEditorContext();
    updateActions();
    renderList();
  }

  function currentDraftContent() {
    return {
      entry_id: state.current?.id ?? null,
      category: refs.entryCategory.value || null,
      title: refs.entryTitle.value,
      body: refs.entryBody.value,
      tags: parseTags(refs.entryTags.value),
      recipient: refs.entryRecipient.value.trim(),
      saved_at: new Date().toISOString(),
    };
  }

  async function clearStoredDraft() {
    if (state.draftTimer) {
      globalThis.clearTimeout(state.draftTimer);
      state.draftTimer = null;
    }
    state.draftActive = false;
    state.draft = null;
    try {
      await draft?.clear();
    } catch {
      // Storage failures must never block writing.
    }
  }

  async function persistDraft() {
    state.draftTimer = null;
    if (!draft || !state.current) return;
    const content = currentDraftContent();
    if (!content.body.trim() && !content.title.trim() && content.tags.length === 0) return;
    try {
      const stored = await draft.save(content);
      if (stored) state.draftActive = true;
    } catch {
      // Keep writing even when the encrypted local copy cannot be written.
    }
  }

  function scheduleDraftSave() {
    if (!draft) return;
    if (state.draftTimer) globalThis.clearTimeout(state.draftTimer);
    state.draftTimer = globalThis.setTimeout(() => void persistDraft(), DRAFT_SAVE_DELAY);
  }

  async function loadStoredDraft() {
    if (!draft) return null;
    try {
      state.draft = await draft.load();
    } catch {
      state.draft = null;
    }
    return state.draft;
  }

  function dropDraftMemory() {
    if (state.draftTimer) {
      globalThis.clearTimeout(state.draftTimer);
      state.draftTimer = null;
    }
    state.draft = null;
    state.draftActive = false;
  }

  async function resumeDraft() {
    const stored = state.draft;
    if (!draft || !stored) return null;
    if (state.dirty && !window.confirm(translate("现在的书写面上还有内容。载入草稿会替换它，确定继续吗？"))) {
      return null;
    }
    if (stored.entry_id) {
      setBusy(true);
      try {
        const data = await api(`/api/entries/${stored.entry_id}`);
        showEditor(await vault.openEntry(data.entry), { expanded: false });
      } catch (error) {
        handleError(error, "无法打开这份草稿对应的纸页。");
        return null;
      } finally {
        setBusy(false);
      }
    } else {
      showEditor(emptyEntry(stored.category ?? "fragment"), { expanded: false });
    }
    refs.entryCategory.value = stored.category ?? "fragment";
    refs.entryTitle.value = stored.title ?? "";
    refs.entryBody.value = stored.body ?? "";
    refs.entryTags.value = (stored.tags ?? []).join("，");
    refs.entryRecipient.value = stored.recipient ?? "";
    state.dirty = true;
    state.draftActive = true;
    state.view = "desk";
    setEditorExpanded(false);
    updateSaveState("有未保存修改", "dirty");
    updateCharacterCount();
    updateEditorContext();
    updateActions();
    renderList();
    refs.entryBody.focus();
    return stored;
  }

  async function discardDraft() {
    const wasResumed = state.draftActive;
    await clearStoredDraft();
    if (wasResumed) {
      state.dirty = false;
      showEditor(emptyEntry(), { expanded: false });
      refs.entryBody.focus();
    } else {
      renderList();
    }
  }

  function canLeaveCurrentDraft() {
    if (!state.dirty) return true;
    const shouldLeave = window.confirm(translate("这张纸还有未保存的修改。确定舍下它并离开吗？"));
    if (shouldLeave) {
      state.dirty = false;
      updateActions();
    }
    return shouldLeave;
  }

  function beginNewEntry(seed = {}, { expanded = false } = {}) {
    if (!canLeaveCurrentDraft()) return;
    const category = seed.category === undefined ? "fragment" : seed.category;
    showEditor(emptyEntry(category, seed), { expanded });
    if (seed.title || seed.body || seed.recipient || (seed.tags?.length ?? 0) > 0) {
      state.dirty = true;
      updateSaveState("有未保存修改", "dirty");
      updateActions();
    }
    refs.entryBody.focus();
  }

  async function loadEntries() {
    const data = await api("/api/entries");
    state.entries = await Promise.all(data.entries.map((entry) => vault.openEntry(entry)));
    state.entriesLoaded = true;
    renderList();
  }

  async function openEntry(entryId, { force = false } = {}) {
    if (!force && state.current?.id !== entryId && !canLeaveCurrentDraft()) return;
    setBusy(true);
    updateSaveState("正在打开…", "saved");
    try {
      const data = await api(`/api/entries/${entryId}`);
      showEditor(await vault.openEntry(data.entry), { expanded: true });
    } catch (error) {
      handleError(error, "无法打开这张纸页。");
    } finally {
      setBusy(false);
    }
  }

  function collapseEditor() {
    setEditorExpanded(false);
    renderList();
    refs.entryBody.focus();
  }

  async function saveCurrentEntry() {
    if (!state.current || state.busy) return null;
    if (!refs.entryTitle.value.trim() && !refs.entryBody.value.trim()) {
      updateSaveState("还没有写下内容", "error");
      showMessage("先写下一句话，再保存这张纸。", "error");
      refs.entryBody.focus();
      return null;
    }

    setBusy(true);
    updateSaveState("正在保存…", "saved");
    try {
      const isExisting = Boolean(state.current.id);
      const entryId = state.current.id ?? crypto.randomUUID();
      const category = refs.entryCategory.value || null;
      const content = {
        title: refs.entryTitle.value.trim(),
        body: refs.entryBody.value,
        tags: parseTags(refs.entryTags.value),
        recipient: category === "letter" ? refs.entryRecipient.value.trim() : "",
      };
      const sealedPayload = await vault.seal("entry", entryId, content);
      const data = await api(isExisting ? `/api/entries/${entryId}` : "/api/entries", {
        method: isExisting ? "PUT" : "POST",
        body: JSON.stringify({
          ...(isExisting ? {} : { id: entryId }),
          category,
          source_topic_id: category === "theme" ? state.current.source_topic_id : null,
          source_letter_day: category === "letter" ? state.current.source_letter_day : null,
          sealed_payload: sealedPayload,
        }),
      });
      state.current = await vault.openEntry(data.entry);
      const savedEntry = state.current;
      state.dirty = false;
      await clearStoredDraft();
      refs.entryDate.textContent = savedEntry.created_at
        ? `写于 ${formatDate(savedEntry.created_at)}`
        : "尚未保存";
      refs.entryEdited.textContent = `最近保存：${formatDate(savedEntry.updated_at)}`;
      refs.entryEdited.hidden = false;
      refs.saveButton.textContent = "保存纸页";
      updateSaveState("已保存", "saved");
      if (!isExisting) {
        showEditor(emptyEntry(), { expanded: false });
        refs.editorPanel.parentElement.scrollTop = 0;
      }
      await loadEntries();
      updateEditorContext();
      onSaved?.({ created: !isExisting, entry: savedEntry });
      showMessage(isExisting ? "纸页的修改已经保存。" : "纸页已经保存。");
      return savedEntry;
    } catch (error) {
      updateSaveState("保存失败", "error");
      handleError(error, "保存失败，请检查连接后重试。");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function ensureSaved() {
    if (!state.current?.id || state.dirty) return saveCurrentEntry();
    return state.current;
  }

  async function removeCurrentEntry() {
    if (!state.current?.id || state.busy) return;
    const removedId = state.current.id;
    setBusy(true);
    try {
      await api(`/api/entries/${removedId}`, { method: "DELETE" });
      if (state.draft?.entry_id === removedId) await clearStoredDraft();
      state.current = null;
      state.dirty = false;
      await loadEntries();
      showEditor(emptyEntry(), { expanded: false });
      showMessage("纸页已经删除。");
    } catch (error) {
      handleError(error, "无法删除这张纸页。");
    } finally {
      setBusy(false);
    }
  }

  async function exportData() {
    try {
      await exportPlaintext();
      showMessage("导出文件已经生成。");
    } catch (error) {
      handleError(error, "导出失败，请稍后重试。");
    }
  }

  function markDirty() {
    if (!state.current) return;
    state.dirty = true;
    updateSaveState("有未保存修改", "dirty");
    updateCharacterCount();
    updateEditorContext();
    updateActions();
    scheduleDraftSave();
  }

  function bindEvents() {
    for (const input of [refs.entryTitle, refs.entryBody, refs.entryCategory, refs.entryTags, refs.entryRecipient]) {
      input.addEventListener(input === refs.entryCategory ? "change" : "input", markDirty);
    }
    refs.saveButton.addEventListener("click", () => void saveCurrentEntry());
    refs.entryContextAction.addEventListener("click", async () => {
      const entry = await ensureSaved();
      if (entry) await onContextAction(entry);
    });
    refs.expandEditorButton.addEventListener("click", () => {
      setEditorExpanded(!state.editorExpanded);
      renderList();
      (state.editorExpanded ? refs.entryTitle : refs.entryBody).focus();
    });
    refs.editorPanel.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void saveCurrentEntry();
      }
      if (event.key === "Escape" && state.view === "page") {
        event.preventDefault();
        collapseEditor();
      }
    });
    refs.deleteEntryButton.addEventListener("click", () => refs.deleteEntryDialog.showModal());
    refs.confirmDeleteEntry.addEventListener("click", () => void removeCurrentEntry());
    refs.exportButton.addEventListener("click", () => void exportData());
  }

  return Object.freeze({
    beginNewEntry,
    bindEvents,
    canLeaveCurrentDraft,
    clearStoredDraft,
    collapseEditor,
    discardDraft,
    dropDraftMemory,
    ensureSaved,
    loadEntries,
    loadStoredDraft,
    openEntry,
    resumeDraft,
    saveCurrentEntry,
    setEditorExpanded,
    showEditor,
  });
}
