import { formatDate } from "./format.js";

const CATEGORY_LABELS = Object.freeze({
  "": "未分类",
  fragment: "碎片",
  theme: "主题",
  letter: "书信",
  book: "书籍",
  journal: "日记",
});

function parseTags(value) {
  return [...new Set(String(value ?? "").split(/[，,、]/u).map((tag) => tag.trim()).filter(Boolean))].slice(0, 20);
}

export function createEntriesFeature({
  state,
  refs,
  api,
  vault,
  exportPlaintext,
  setBusy,
  updateActions,
  renderList,
  showEmptyEditor = () => {},
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
    refs.editorPanel.classList.toggle("editor-panel--expanded", expanded);
    refs.expandEditorButton.setAttribute("aria-pressed", String(expanded));
    refs.expandEditorButton.textContent = expanded ? "收起纸页" : "展开书写";
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
    refs.editorEmpty.hidden = true;
    refs.editorPanel.hidden = false;
    refs.editorPanel.parentElement.scrollTop = 0;
    refs.entryCategory.value = state.current.category ?? "";
    refs.entryTags.value = (state.current.tags ?? []).join("，");
    refs.entryRecipient.value = state.current.recipient ?? "";
    refs.entryTitle.value = state.current.title ?? "";
    refs.entryBody.value = state.current.body ?? "";
    refs.entryDate.textContent = state.current.updated_at
      ? `最近保存：${formatDate(state.current.updated_at)}`
      : "尚未保存";
    refs.saveButton.textContent = state.current.id ? "保存修改" : "保存纸页";
    setEditorExpanded(expanded);
    updateSaveState(state.current.updated_at ? "已保存" : "尚未保存", "saved");
    updateCharacterCount();
    updateEditorContext();
    updateActions();
    renderList();
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

  function beginNewEntry(seed = {}) {
    if (!canLeaveCurrentDraft()) return;
    const category = seed.category === undefined ? "fragment" : seed.category;
    showEditor({
      id: null,
      title: "",
      body: "",
      tags: [],
      category,
      source_topic_id: null,
      source_letter_day: null,
      updated_at: null,
      ...seed,
    }, { expanded: false });
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
        title: refs.entryTitle.value.trim() || `未命名${CATEGORY_LABELS[category ?? ""]}`,
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
      state.dirty = false;
      refs.entryDate.textContent = `最近保存：${formatDate(state.current.updated_at)}`;
      refs.saveButton.textContent = "保存修改";
      updateSaveState("已保存", "saved");
      await loadEntries();
      updateEditorContext();
      onSaved?.({ created: !isExisting, entry: state.current });
      showMessage(isExisting ? "纸页修改已经保存。" : "纸页已经放回书桌。");
      return state.current;
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
    setBusy(true);
    try {
      await api(`/api/entries/${state.current.id}`, { method: "DELETE" });
      await loadEntries();
      showEmptyEditor();
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
      (state.editorExpanded ? refs.entryTitle : refs.entryBody).focus();
    });
    refs.editorPanel.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void saveCurrentEntry();
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
    ensureSaved,
    loadEntries,
    openEntry,
    saveCurrentEntry,
    setEditorExpanded,
    showEditor,
  });
}
