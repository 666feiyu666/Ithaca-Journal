import { ApiClientError } from "./api-client.js";
import { formatDate } from "./format.js";

export function createEntriesFeature({
  state,
  refs,
  api,
  setBusy,
  updateActions,
  renderList,
  showEmptyEditor,
  showMessage,
  handleError,
}) {
  function updateSaveState(label, status = "saved") {
    refs.saveState.textContent = label;
    refs.saveState.dataset.state = status;
  }

  function updateCharacterCount() {
    refs.characterCount.textContent = `${refs.entryBody.value.length.toLocaleString("zh-CN")} 个字符`;
  }

  function showEditor(entry) {
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
    updateSaveState(entry.updated_at ? "已保存" : "尚未保存", "saved");
    updateCharacterCount();
    updateActions();
    renderList();
  }

  function canLeaveCurrentDraft() {
    return !state.dirty || window.confirm("这篇手记还有未保存的修改。确定离开吗？");
  }

  function beginNewEntry() {
    if (!canLeaveCurrentDraft()) {
      return;
    }
    state.workbenchMode = "fragments";
    showEditor({ id: null, title: "", body: "", updated_at: null });
    state.dirty = true;
    updateSaveState("尚未保存", "dirty");
    updateActions();
    refs.entryTitle.focus();
  }

  async function loadEntries() {
    const data = await api("/api/entries");
    state.entries = data.entries;
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
      showEditor(data.entry);
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

    setBusy(true);
    updateSaveState("正在保存…", "saved");
    const payload = JSON.stringify({
      title: refs.entryTitle.value,
      body: refs.entryBody.value,
    });

    try {
      const isExisting = Boolean(state.current.id);
      const data = await api(
        isExisting ? `/api/entries/${state.current.id}` : "/api/entries",
        { method: isExisting ? "PUT" : "POST", body: payload },
      );
      state.current = data.entry;
      state.dirty = false;
      refs.entryDate.textContent = `最近保存：${formatDate(data.entry.updated_at)}`;
      updateSaveState("已保存", "saved");
      await loadEntries();
      renderList();
      showMessage("碎片已经保存。");
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
      if (state.entries[0]) {
        await openEntry(state.entries[0].id, { force: true });
      } else {
        showEmptyEditor();
      }
      showMessage("碎片已经删除。");
    } catch (error) {
      handleError(error, "无法删除这则碎片。");
    } finally {
      setBusy(false);
    }
  }

  async function exportData() {
    try {
      const response = await fetch("/api/export", {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new ApiClientError(
          response.status,
          data?.error?.code ?? "export_failed",
          data?.error?.message ?? "导出失败。",
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ithaca-journal-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
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
    showEditor,
  });
}
