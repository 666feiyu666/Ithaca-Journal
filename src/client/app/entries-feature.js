import { formatDate } from "./format.js";

export function createEntriesFeature({
  state,
  refs,
  api,
  vault,
  exportPlaintext,
  setBusy,
  updateActions,
  renderList,
  showMessage,
  handleError,
  onSaved,
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

  function showEditor(entry, { expanded = Boolean(entry.id) } = {}) {
    state.current = entry;
    state.dirty = false;
    refs.editorEmpty.hidden = true;
    refs.topicPanel.hidden = true;
    refs.editorPanel.hidden = false;
    refs.editorPanel.parentElement.scrollTop = 0;
    refs.entryTitle.value = entry.title ?? "";
    refs.entryBody.value = entry.body ?? "";
    refs.entryDate.textContent = entry.updated_at
      ? `最近保存：${formatDate(entry.updated_at)}`
      : "尚未保存";
    refs.saveButton.textContent = entry.id ? "保存修改" : "收进碎片匣";
    setEditorExpanded(expanded);
    updateSaveState(entry.updated_at ? "已保存" : "尚未保存", "saved");
    updateCharacterCount();
    updateActions();
    renderList();
  }

  function canLeaveCurrentDraft() {
    if (!state.dirty) {
      return true;
    }
    const shouldLeave = window.confirm("这张纸还有未保存的修改。确定舍下它并离开吗？");
    if (shouldLeave) {
      state.dirty = false;
      updateActions();
    }
    return shouldLeave;
  }

  function beginNewEntry() {
    if (!canLeaveCurrentDraft()) {
      return;
    }
    state.workbenchMode = "fragments";
    showEditor({ id: null, title: "", body: "", updated_at: null }, { expanded: false });
    updateActions();
    refs.entryBody.focus();
  }

  async function loadEntries() {
    const data = await api("/api/entries");
    state.entries = await Promise.all(data.entries.map((entry) => vault.openEntry(entry)));
    state.entriesLoaded = true;
    renderList();
  }

  async function openEntry(entryId, { force = false } = {}) {
    if (!force && state.current?.id !== entryId && !canLeaveCurrentDraft()) {
      return;
    }

    setBusy(true);
    updateSaveState("正在打开…", "saved");
    try {
      const data = await api(`/api/entries/${entryId}`);
      showEditor(await vault.openEntry(data.entry), { expanded: true });
    } catch (error) {
      handleError(error, "无法打开这则碎片笔记。");
    } finally {
      setBusy(false);
    }
  }

  async function saveCurrentEntry() {
    if (!state.current || state.busy) {
      return;
    }

    if (!refs.entryTitle.value.trim() && !refs.entryBody.value.trim()) {
      updateSaveState("还没有写下内容", "error");
      showMessage("先写下一句话，再把这张纸收进碎片匣。", "error");
      refs.entryBody.focus();
      return;
    }

    setBusy(true);
    updateSaveState("正在保存…", "saved");
    try {
      const isExisting = Boolean(state.current.id);
      const entryId = state.current.id ?? crypto.randomUUID();
      const content = {
        title: refs.entryTitle.value.trim() || "未命名碎片",
        body: refs.entryBody.value,
      };
      const sealedPayload = await vault.seal("entry", entryId, content);
      const data = await api(
        isExisting ? `/api/entries/${state.current.id}` : "/api/entries",
        {
          method: isExisting ? "PUT" : "POST",
          body: JSON.stringify({
            ...(isExisting ? {} : { id: entryId }),
            sealed_payload: sealedPayload,
          }),
        },
      );
      state.current = await vault.openEntry(data.entry);
      state.dirty = false;
      refs.entryDate.textContent = `最近保存：${formatDate(state.current.updated_at)}`;
      refs.saveButton.textContent = "保存修改";
      updateSaveState("已保存", "saved");
      await loadEntries();
      renderList();
      onSaved?.({ created: !isExisting, entry: state.current });
      showMessage(isExisting ? "这张纸的修改已经保存。" : "这张纸已经收进碎片匣。");
    } catch (error) {
      updateSaveState("保存失败", "error");
      handleError(error, "保存失败，请检查连接后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function removeCurrentEntry() {
    if (!state.current?.id || state.busy) {
      return;
    }
    const entryId = state.current.id;
    setBusy(true);
    try {
      await api(`/api/entries/${entryId}`, { method: "DELETE" });
      await loadEntries();
      showEditor({ id: null, title: "", body: "", updated_at: null }, { expanded: false });
      refs.entryBody.focus();
      showMessage("碎片已经删除。");
    } catch (error) {
      handleError(error, "无法删除这则碎片。");
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

  function bindEvents() {
    for (const input of [refs.entryTitle, refs.entryBody]) {
      input.addEventListener("input", () => {
        if (!state.current) {
          return;
        }
        state.dirty = true;
        updateSaveState("有未保存修改", "dirty");
        updateCharacterCount();
        updateActions();
      });
    }
    refs.saveButton.addEventListener("click", () => void saveCurrentEntry());
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
    loadEntries,
    openEntry,
    saveCurrentEntry,
    setEditorExpanded,
    showEditor,
  });
}
