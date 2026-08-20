const state = {
  user: null,
  entries: [],
  current: null,
  dirty: false,
  busy: false,
  messageTimer: null,
};

const refs = {
  authView: document.querySelector("#auth-view"),
  appView: document.querySelector("#app-view"),
  inviteForm: document.querySelector("#invite-form"),
  inviteSubmit: document.querySelector("#invite-submit"),
  inviteError: document.querySelector("#invite-error"),
  email: document.querySelector("#email"),
  inviteCode: document.querySelector("#invite-code"),
  connectionDot: document.querySelector("#connection-dot"),
  connectionLabel: document.querySelector("#connection-label"),
  signedInEmail: document.querySelector("#signed-in-email"),
  entryList: document.querySelector("#entry-list"),
  listEmpty: document.querySelector("#list-empty"),
  newEntryButton: document.querySelector("#new-entry-button"),
  emptyNewButton: document.querySelector("#empty-new-button"),
  editorEmpty: document.querySelector("#editor-empty"),
  editorPanel: document.querySelector("#editor-panel"),
  entryDate: document.querySelector("#entry-date"),
  entryTitle: document.querySelector("#entry-title"),
  entryBody: document.querySelector("#entry-body"),
  characterCount: document.querySelector("#character-count"),
  saveState: document.querySelector("#save-state"),
  saveButton: document.querySelector("#save-button"),
  deleteEntryButton: document.querySelector("#delete-entry-button"),
  deleteEntryDialog: document.querySelector("#delete-entry-dialog"),
  confirmDeleteEntry: document.querySelector("#confirm-delete-entry"),
  exportButton: document.querySelector("#export-button"),
  accountButton: document.querySelector("#account-button"),
  logoutButton: document.querySelector("#logout-button"),
  deleteAccountDialog: document.querySelector("#delete-account-dialog"),
  deleteAccountForm: document.querySelector("#delete-account-form"),
  deleteConfirmation: document.querySelector("#delete-confirmation"),
  deleteAccountError: document.querySelector("#delete-account-error"),
  cancelDeleteAccount: document.querySelector("#cancel-delete-account"),
  appMessage: document.querySelector("#app-message"),
};

class ApiClientError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
  });

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  const data = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    const error = data?.error;
    throw new ApiClientError(
      response.status,
      error?.code ?? "request_failed",
      error?.message ?? "请求失败，请稍后重试。",
    );
  }
  return data;
}

function formatDate(value) {
  if (!value) {
    return "尚未保存";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function updateConnectivity() {
  const online = navigator.onLine;
  refs.connectionDot.dataset.state = online ? "online" : "offline";
  refs.connectionLabel.textContent = online ? "已连接" : "当前离线";
}

function showMessage(message, type = "success") {
  if (state.messageTimer) {
    window.clearTimeout(state.messageTimer);
  }
  refs.appMessage.textContent = message;
  refs.appMessage.dataset.state = type;
  refs.appMessage.hidden = false;
  state.messageTimer = window.setTimeout(() => {
    refs.appMessage.hidden = true;
  }, 4_000);
}

function setInviteError(message = "") {
  refs.inviteError.textContent = message;
  refs.inviteError.hidden = !message;
}

function setDeleteAccountError(message = "") {
  refs.deleteAccountError.textContent = message;
  refs.deleteAccountError.hidden = !message;
}

function showAuth() {
  state.user = null;
  state.entries = [];
  state.current = null;
  state.dirty = false;
  refs.appView.hidden = true;
  refs.authView.hidden = false;
  setInviteError();
  refs.inviteCode.value = "";
  refs.email.focus();
}

function showApp(user) {
  state.user = user;
  refs.signedInEmail.textContent = user.email;
  refs.authView.hidden = true;
  refs.appView.hidden = false;
  updateConnectivity();
}

function setBusy(busy) {
  state.busy = busy;
  refs.inviteSubmit.disabled = busy;
  updateEditorActions();
}

function updateEditorActions() {
  refs.saveButton.disabled = state.busy || !state.dirty;
  refs.deleteEntryButton.disabled = state.busy || !state.current?.id;
  refs.newEntryButton.disabled = state.busy;
}

function updateSaveState(label, status = "saved") {
  refs.saveState.textContent = label;
  refs.saveState.dataset.state = status;
}

function updateCharacterCount() {
  refs.characterCount.textContent = `${refs.entryBody.value.length.toLocaleString("zh-CN")} 个字符`;
}

function renderEntryList() {
  refs.entryList.replaceChildren();
  refs.listEmpty.hidden = state.entries.length !== 0;

  for (const entry of state.entries) {
    const listItem = document.createElement("div");
    listItem.setAttribute("role", "listitem");
    const item = document.createElement("button");
    item.type = "button";
    item.className = "entry-list__item";
    item.dataset.entryId = entry.id;
    item.setAttribute("aria-current", String(state.current?.id === entry.id));

    const title = document.createElement("span");
    title.className = "entry-list__title";
    title.textContent = entry.title || "未命名手记";

    const date = document.createElement("span");
    date.className = "entry-list__date";
    date.textContent = formatDate(entry.updated_at);

    item.append(title, date);
    item.addEventListener("click", () => {
      void openEntry(entry.id);
    });
    listItem.append(item);
    refs.entryList.append(listItem);
  }
}

function showEditor(entry) {
  state.current = entry;
  state.dirty = false;
  refs.editorEmpty.hidden = true;
  refs.editorPanel.hidden = false;
  refs.entryTitle.value = entry.title ?? "";
  refs.entryBody.value = entry.body ?? "";
  refs.entryDate.textContent = entry.updated_at
    ? `最近保存：${formatDate(entry.updated_at)}`
    : "尚未保存";
  updateSaveState(entry.updated_at ? "已保存" : "尚未保存", "saved");
  updateCharacterCount();
  updateEditorActions();
  renderEntryList();
}

function showEmptyEditor() {
  state.current = null;
  state.dirty = false;
  refs.editorPanel.hidden = true;
  refs.editorEmpty.hidden = false;
  updateEditorActions();
  renderEntryList();
}

function canLeaveCurrentDraft() {
  return !state.dirty || window.confirm("这篇手记还有未保存的修改。确定离开吗？");
}

function beginNewEntry() {
  if (!canLeaveCurrentDraft()) {
    return;
  }
  showEditor({ id: null, title: "", body: "", updated_at: null });
  state.dirty = true;
  updateSaveState("尚未保存", "dirty");
  updateEditorActions();
  refs.entryTitle.focus();
}

async function loadEntries() {
  const data = await api("/api/entries");
  state.entries = data.entries;
  renderEntryList();
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
    handleAppError(error, "无法打开这篇手记。");
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
    renderEntryList();
    showMessage("手记已经保存。");
  } catch (error) {
    updateSaveState("保存失败", "error");
    handleAppError(error, "保存失败，请检查连接后重试。");
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
    showMessage("手记已经删除。");
  } catch (error) {
    handleAppError(error, "无法删除这篇手记。");
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
    handleAppError(error, "导出失败，请稍后重试。");
  }
}

async function logout() {
  if (!canLeaveCurrentDraft()) {
    return;
  }
  setBusy(true);
  try {
    await api("/api/session", { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof ApiClientError && error.status === 401)) {
      handleAppError(error, "退出时发生问题。");
    }
  } finally {
    setBusy(false);
    showAuth();
  }
}

async function deleteAccount(event) {
  event.preventDefault();
  const confirmation = refs.deleteConfirmation.value;
  if (confirmation !== "DELETE") {
    setDeleteAccountError("请输入 DELETE 以确认。");
    refs.deleteConfirmation.focus();
    return;
  }

  setBusy(true);
  try {
    await api("/api/account", {
      method: "DELETE",
      body: JSON.stringify({ confirmation }),
    });
    refs.deleteAccountDialog.close();
    refs.deleteConfirmation.value = "";
    showAuth();
  } catch (error) {
    setDeleteAccountError(
      error instanceof Error ? error.message : "删除失败，请稍后重试。",
    );
  } finally {
    setBusy(false);
  }
}

function handleAppError(error, fallbackMessage) {
  if (error instanceof ApiClientError && error.status === 401) {
    showAuth();
    setInviteError("会话已经失效，请重新使用邀请进入。");
    return;
  }
  showMessage(error instanceof Error ? error.message : fallbackMessage, "error");
}

async function startApp(user) {
  showApp(user);
  setBusy(true);
  try {
    await loadEntries();
    if (state.entries[0]) {
      await openEntry(state.entries[0].id, { force: true });
    } else {
      showEmptyEditor();
    }
  } catch (error) {
    handleAppError(error, "无法读取手记列表。");
  } finally {
    setBusy(false);
  }
}

async function restoreSession() {
  try {
    const data = await api("/api/session");
    await startApp(data.user);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      showAuth();
      return;
    }
    showAuth();
    setInviteError("暂时无法连接服务，请稍后重试。");
  }
}

refs.inviteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setInviteError();
  if (!refs.inviteForm.reportValidity()) {
    return;
  }

  setBusy(true);
  refs.inviteSubmit.textContent = "正在进入…";
  try {
    const data = await api("/api/auth/invite", {
      method: "POST",
      body: JSON.stringify({
        email: refs.email.value,
        code: refs.inviteCode.value,
      }),
    });
    await startApp(data.user);
  } catch (error) {
    setInviteError(error instanceof Error ? error.message : "无法使用这个邀请。");
  } finally {
    refs.inviteSubmit.textContent = "进入伊萨卡";
    setBusy(false);
  }
});

for (const input of [refs.entryTitle, refs.entryBody]) {
  input.addEventListener("input", () => {
    if (!state.current) {
      return;
    }
    state.dirty = true;
    updateSaveState("有未保存修改", "dirty");
    updateCharacterCount();
    updateEditorActions();
  });
}

refs.newEntryButton.addEventListener("click", beginNewEntry);
refs.emptyNewButton.addEventListener("click", beginNewEntry);
refs.saveButton.addEventListener("click", () => void saveCurrentEntry());
refs.deleteEntryButton.addEventListener("click", () => refs.deleteEntryDialog.showModal());
refs.confirmDeleteEntry.addEventListener("click", () => void removeCurrentEntry());
refs.exportButton.addEventListener("click", () => void exportData());
refs.logoutButton.addEventListener("click", () => void logout());
refs.accountButton.addEventListener("click", () => {
  setDeleteAccountError();
  refs.deleteConfirmation.value = "";
  refs.deleteAccountDialog.showModal();
  refs.deleteConfirmation.focus();
});
refs.cancelDeleteAccount.addEventListener("click", () => refs.deleteAccountDialog.close());
refs.deleteAccountForm.addEventListener("submit", (event) => void deleteAccount(event));
window.addEventListener("online", updateConnectivity);
window.addEventListener("offline", updateConnectivity);
window.addEventListener("beforeunload", (event) => {
  if (state.dirty) {
    event.preventDefault();
  }
});

void restoreSession();
