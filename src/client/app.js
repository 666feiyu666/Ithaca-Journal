import { createDialogueRuntime } from "./game/dialogue-runtime.js";
import { dialogues } from "./game/dialogues.js";
import { createSceneRegistry } from "./game/scene-registry.js";
import { createSceneRuntime } from "./game/scene-runtime.js";
import { doorwayScene } from "./game/scenes/doorway.js";
import { roomScene } from "./game/scenes/room.js";
import { createTimeService } from "./game/time-service.js";

const state = {
  user: null,
  journey: null,
  entries: [],
  entriesLoaded: false,
  topics: [],
  topicsLoaded: false,
  books: [],
  booksLoaded: false,
  letters: [],
  current: null,
  currentTopic: null,
  currentBook: null,
  workbenchMode: "fragments",
  dirty: false,
  busy: false,
  introIndex: 0,
  messageTimer: null,
};

const INTRO_LINES = [
  { speaker: "我", text: "（拖着行李箱的声音）呼……终于到了。" },
  { speaker: "我", text: "看着手机上的导航，应该就是这里没错了。" },
  { speaker: "我", text: "刚来到这座陌生城市，能找到这个安静的单间，已经很幸运了。" },
  { speaker: "我", text: "门外是一只旧信箱。房间里只留下了一张书桌和一座旧书架。" },
  { speaker: "我", text: "先住下来吧。也许，我可以从这里重新开始书写。" },
];

const refs = {
  authView: document.querySelector("#auth-view"),
  titleView: document.querySelector("#title-view"),
  introView: document.querySelector("#intro-view"),
  sceneView: document.querySelector("#scene-view"),
  appView: document.querySelector("#app-view"),
  booksView: document.querySelector("#books-view"),
  accessTitle: document.querySelector("#access-title"),
  accessStatus: document.querySelector("#access-status"),
  accessError: document.querySelector("#access-error"),
  accessRetry: document.querySelector("#access-retry"),
  accessLogin: document.querySelector("#access-login"),
  journeyAction: document.querySelector("#journey-action"),
  journeyActionLabel: document.querySelector("#journey-action-label"),
  journeyMeta: document.querySelector("#journey-meta"),
  titleEmail: document.querySelector("#title-email"),
  titleAccountButton: document.querySelector("#title-account-button"),
  titleLogoutButton: document.querySelector("#title-logout-button"),
  introSpeaker: document.querySelector("#intro-speaker"),
  introLine: document.querySelector("#intro-line"),
  introNext: document.querySelector("#intro-next"),
  sceneDay: document.querySelector("#scene-day"),
  sceneEmail: document.querySelector("#scene-email"),
  sceneAccountButton: document.querySelector("#scene-account-button"),
  sceneLogoutButton: document.querySelector("#scene-logout-button"),
  sceneDate: document.querySelector("#scene-date"),
  sceneWeekday: document.querySelector("#scene-weekday"),
  scenePhase: document.querySelector("#scene-phase"),
  sceneTime: document.querySelector("[data-scene-time]"),
  sceneDialogue: document.querySelector("[data-dialogue-root]"),
  returnRoomButton: document.querySelector("#return-room-button"),
  booksReturnRoomButton: document.querySelector("#books-return-room-button"),
  connectionDot: document.querySelector("#connection-dot"),
  connectionLabel: document.querySelector("#connection-label"),
  signedInEmail: document.querySelector("#signed-in-email"),
  entryList: document.querySelector("#entry-list"),
  listEmpty: document.querySelector("#list-empty"),
  newEntryButton: document.querySelector("#new-entry-button"),
  newTopicButton: document.querySelector("#new-topic-button"),
  fragmentTab: document.querySelector("#fragment-tab"),
  topicTab: document.querySelector("#topic-tab"),
  emptyNewButton: document.querySelector("#empty-new-button"),
  editorEmpty: document.querySelector("#editor-empty"),
  editorEmptyIndex: document.querySelector("#editor-empty-index"),
  editorEmptyTitle: document.querySelector("#editor-empty-title"),
  editorEmptyCopy: document.querySelector("#editor-empty-copy"),
  editorPanel: document.querySelector("#editor-panel"),
  topicPanel: document.querySelector("#topic-panel"),
  topicDate: document.querySelector("#topic-date"),
  topicTitle: document.querySelector("#topic-title"),
  topicBody: document.querySelector("#topic-body"),
  topicSourceList: document.querySelector("#topic-source-list"),
  editTopicButton: document.querySelector("#edit-topic-button"),
  deleteTopicButton: document.querySelector("#delete-topic-button"),
  topicDialog: document.querySelector("#topic-dialog"),
  topicForm: document.querySelector("#topic-form"),
  topicDialogTitle: document.querySelector("#topic-dialog-title"),
  topicId: document.querySelector("#topic-id"),
  topicTitleInput: document.querySelector("#topic-title-input"),
  topicBodyInput: document.querySelector("#topic-body-input"),
  topicFragmentOptions: document.querySelector("#topic-fragment-options"),
  topicFormError: document.querySelector("#topic-form-error"),
  cancelTopic: document.querySelector("#cancel-topic"),
  saveTopic: document.querySelector("#save-topic"),
  deleteTopicDialog: document.querySelector("#delete-topic-dialog"),
  confirmDeleteTopic: document.querySelector("#confirm-delete-topic"),
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
  deleteAccountIndex: document.querySelector("#delete-account-index"),
  deleteAccountTitle: document.querySelector("#delete-account-title"),
  deleteAccountCopy: document.querySelector("#delete-account-copy"),
  deleteAccountLabel: document.querySelector("#delete-account-label"),
  deleteConfirmation: document.querySelector("#delete-confirmation"),
  deleteAccountError: document.querySelector("#delete-account-error"),
  cancelDeleteAccount: document.querySelector("#cancel-delete-account"),
  confirmDeleteAccount: document.querySelector("#confirm-delete-account"),
  compileBookButton: document.querySelector("#compile-book-button"),
  emptyCompileBookButton: document.querySelector("#empty-compile-book-button"),
  booksEmail: document.querySelector("#books-email"),
  bookList: document.querySelector("#book-list"),
  bookListEmpty: document.querySelector("#book-list-empty"),
  bookEmpty: document.querySelector("#book-empty"),
  bookReader: document.querySelector("#book-reader"),
  bookDate: document.querySelector("#book-date"),
  bookTitle: document.querySelector("#book-title"),
  bookContent: document.querySelector("#book-content"),
  deleteBookButton: document.querySelector("#delete-book-button"),
  compileBookDialog: document.querySelector("#compile-book-dialog"),
  compileBookForm: document.querySelector("#compile-book-form"),
  bookTitleInput: document.querySelector("#book-title-input"),
  bookPrefaceInput: document.querySelector("#book-preface-input"),
  bookTopicOptions: document.querySelector("#book-topic-options"),
  compileBookError: document.querySelector("#compile-book-error"),
  cancelCompileBook: document.querySelector("#cancel-compile-book"),
  confirmCompileBook: document.querySelector("#confirm-compile-book"),
  deleteBookDialog: document.querySelector("#delete-book-dialog"),
  confirmDeleteBook: document.querySelector("#confirm-delete-book"),
  letterDialog: document.querySelector("#letter-dialog"),
  letterDay: document.querySelector("#letter-day"),
  letterTitle: document.querySelector("#letter-title"),
  letterSender: document.querySelector("#letter-sender"),
  letterSelect: document.querySelector("#letter-select"),
  letterContent: document.querySelector("#letter-content"),
  appMessage: document.querySelector("#app-message"),
};

const sceneRegistry = createSceneRegistry([doorwayScene, roomScene]);
const timeService = createTimeService();
const dialogueRuntime = createDialogueRuntime(refs.sceneDialogue);
const sceneRuntime = createSceneRuntime({
  root: refs.sceneView,
  registry: sceneRegistry,
  dialogues,
  dialogueRuntime,
  timeService,
  actions: {
    openLetter: () => openJourneyLetter(),
    openWorkbench: () => openWorkbench(),
    openBookshelf: () => openBookshelf(),
  },
  onError: (error) => handleAppError(error, "场景交互暂时无法继续。"),
});

timeService.subscribe(renderSceneTime);
timeService.start();

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

function renderSceneTime(snapshot) {
  refs.sceneDate.textContent = snapshot.dateLabel;
  refs.sceneWeekday.textContent = snapshot.weekdayLabel;
  refs.scenePhase.textContent = snapshot.phaseLabel;
  refs.sceneTime.setAttribute(
    "aria-label",
    `${snapshot.fullDateLabel}，${snapshot.phaseLabel}`,
  );
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

function setAccessError(message = "") {
  refs.accessError.textContent = message;
  refs.accessError.hidden = !message;
}

function setDeleteAccountError(message = "") {
  refs.deleteAccountError.textContent = message;
  refs.deleteAccountError.hidden = !message;
}

function showAuth({
  title = "正在确认访问身份",
  status = "本地开发将使用隔离的开发身份；线上测试由 Cloudflare Access 验证受邀邮箱。",
  error = "",
  canLogin = false,
} = {}) {
  state.user = null;
  state.journey = null;
  state.entries = [];
  state.entriesLoaded = false;
  state.topics = [];
  state.topicsLoaded = false;
  state.books = [];
  state.booksLoaded = false;
  state.letters = [];
  state.current = null;
  state.currentTopic = null;
  state.currentBook = null;
  state.workbenchMode = "fragments";
  state.dirty = false;
  refs.booksView.hidden = true;
  refs.appView.hidden = true;
  refs.sceneView.hidden = true;
  refs.introView.hidden = true;
  refs.titleView.hidden = true;
  refs.authView.hidden = false;
  refs.accessTitle.textContent = title;
  refs.accessStatus.textContent = status;
  refs.accessRetry.hidden = false;
  refs.accessLogin.hidden = !canLogin;
  setAccessError(error);
}

function focusWhenReady(element) {
  window.requestAnimationFrame(() => {
    if (!element.disabled && !element.closest("[hidden]")) {
      element.focus({ preventScroll: true });
    }
  });
}

function showTitle(user, journey) {
  state.user = user;
  state.journey = journey;
  refs.authView.hidden = true;
  refs.introView.hidden = true;
  refs.sceneView.hidden = true;
  refs.appView.hidden = true;
  refs.booksView.hidden = true;
  refs.titleView.hidden = false;
  refs.titleEmail.textContent = user.email;
  refs.titleLogoutButton.hidden = user.source !== "cloudflare-access";
  configureAccountControls(user, journey);

  if (!journey) {
    refs.journeyActionLabel.textContent = "开始旅程";
    refs.journeyMeta.textContent = "从陌生城市的第一夜开始";
  } else if (journey.status === "completed") {
    refs.journeyActionLabel.textContent = "回到房间";
    refs.journeyMeta.textContent = "二十一天之后，书写仍在继续";
  } else {
    refs.journeyActionLabel.textContent = "继续旅程";
    refs.journeyMeta.textContent = `第 ${journey.current_day} 天 · 回到你的房间`;
  }
  focusWhenReady(refs.journeyAction);
}

function showIntro() {
  refs.authView.hidden = true;
  refs.titleView.hidden = true;
  refs.sceneView.hidden = true;
  refs.appView.hidden = true;
  refs.booksView.hidden = true;
  refs.introView.hidden = false;
  state.introIndex = 0;
  renderIntroLine();
}

function renderIntroLine() {
  const line = INTRO_LINES[state.introIndex];
  refs.introSpeaker.textContent = line.speaker;
  refs.introLine.textContent = line.text;
  refs.introNext.textContent = state.introIndex === INTRO_LINES.length - 1 ? "走到门外" : "继续";
  focusWhenReady(refs.introNext);
}

function showScene(sceneId = "room") {
  const journey = state.journey;
  if (!state.user || !journey) {
    return;
  }
  refs.authView.hidden = true;
  refs.titleView.hidden = true;
  refs.introView.hidden = true;
  refs.appView.hidden = true;
  refs.booksView.hidden = true;
  refs.sceneView.hidden = false;
  window.scrollTo({ top: 0, left: 0 });
  refs.sceneDay.textContent = journey.status === "completed" ? "旅程之后" : `第 ${journey.current_day} 天`;
  refs.sceneEmail.textContent = state.user.email;
  refs.sceneLogoutButton.hidden = state.user.source !== "cloudflare-access";
  sceneRuntime.show(sceneId);
}

function showApp(user) {
  state.user = user;
  refs.signedInEmail.textContent = user.email;
  refs.logoutButton.hidden = user.source !== "cloudflare-access";
  refs.authView.hidden = true;
  refs.titleView.hidden = true;
  refs.introView.hidden = true;
  refs.sceneView.hidden = true;
  refs.booksView.hidden = true;
  refs.appView.hidden = false;
  window.scrollTo({ top: 0, left: 0 });
  updateConnectivity();
}

function setBusy(busy) {
  state.busy = busy;
  refs.accessRetry.disabled = busy;
  refs.journeyAction.disabled = busy;
  refs.introNext.disabled = busy;
  refs.confirmDeleteAccount.disabled = busy;
  updateEditorActions();
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function enterCurrentJourney() {
  if (state.busy) {
    return;
  }

  setBusy(true);
  try {
    const data = await api("/api/journey", {
      method: "POST",
      body: JSON.stringify({ local_date: localDateString() }),
    });
    state.journey = data.journey;
    state.letters = [];
    if (data.journey.intro_completed_at) {
      showScene("room");
    } else {
      showIntro();
    }
  } catch (error) {
    handleAppError(error, "暂时无法进入旅程，请稍后重试。");
  } finally {
    setBusy(false);
  }
}

async function advanceIntro() {
  if (state.busy) {
    return;
  }
  if (state.introIndex < INTRO_LINES.length - 1) {
    state.introIndex += 1;
    renderIntroLine();
    return;
  }

  setBusy(true);
  try {
    const data = await api("/api/journey/intro", { method: "PUT" });
    state.journey = data.journey;
    showScene("doorway");
  } catch (error) {
    handleAppError(error, "暂时无法保存序章进度，请稍后重试。");
  } finally {
    setBusy(false);
  }
}

function setTopicFormError(message = "") {
  refs.topicFormError.textContent = message;
  refs.topicFormError.hidden = !message;
}

function setCompileBookError(message = "") {
  refs.compileBookError.textContent = message;
  refs.compileBookError.hidden = !message;
}

function configureAccountControls(user = state.user, journey = state.journey) {
  const isDevelopment = user?.source === "development";
  const accountLabel = isDevelopment ? "重新体验 0.2.0" : "删除数据";
  refs.titleAccountButton.textContent = accountLabel;
  refs.sceneAccountButton.textContent = isDevelopment ? "重置测试" : "删除数据";
  refs.accountButton.textContent = isDevelopment ? "重置测试" : "删除数据";
  refs.titleAccountButton.hidden = isDevelopment && !journey;

  if (isDevelopment) {
    refs.deleteAccountIndex.textContent = "本地验收工具";
    refs.deleteAccountTitle.textContent = "重新体验完整流程？";
    refs.deleteAccountCopy.textContent =
      "这会清除当前本地开发身份的旅程、来信阅读状态、碎片、主题和成书，然后自动回到“开始旅程”。它不会影响 staging、production 或 Cloudflare Access 允许名单。";
    refs.deleteAccountLabel.innerHTML = "输入 <strong>RESET</strong> 以重新开始";
    refs.deleteConfirmation.placeholder = "RESET";
    refs.confirmDeleteAccount.textContent = "清除并重新开始";
    return;
  }

  refs.deleteAccountIndex.textContent = "永久删除";
  refs.deleteAccountTitle.textContent = "删除全部云端数据？";
  refs.deleteAccountCopy.textContent =
    "这将删除当前应用账户、旅程、来信阅读状态、碎片、主题和成书，但不会修改 Cloudflare Access 的邮箱允许名单。再次登录会建立一个空账户。该操作无法撤销。";
  refs.deleteAccountLabel.innerHTML = "输入 <strong>DELETE</strong> 以继续";
  refs.deleteConfirmation.placeholder = "DELETE";
  refs.confirmDeleteAccount.textContent = "永久删除";
}

function openDeleteAccountDialog() {
  configureAccountControls();
  setDeleteAccountError();
  refs.deleteConfirmation.value = "";
  refs.deleteAccountDialog.showModal();
  refs.deleteConfirmation.focus();
}

function updateEditorActions() {
  refs.saveButton.disabled = state.busy || !state.dirty;
  refs.deleteEntryButton.disabled = state.busy || !state.current?.id;
  refs.newEntryButton.disabled = state.busy;
  refs.newTopicButton.disabled = state.busy;
  refs.saveTopic.disabled = state.busy;
  refs.compileBookButton.disabled = state.busy;
  refs.emptyCompileBookButton.disabled = state.busy;
  refs.confirmCompileBook.disabled = state.busy;
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
  const isFragments = state.workbenchMode === "fragments";
  const records = isFragments ? state.entries : state.topics;
  refs.listEmpty.textContent = isFragments
    ? "还没有保存的碎片笔记。"
    : "还没有主题笔记。先选择几则碎片，把它们放在一起。";
  refs.listEmpty.hidden = records.length !== 0;

  for (const entry of records) {
    const listItem = document.createElement("div");
    listItem.setAttribute("role", "listitem");
    const item = document.createElement("button");
    item.type = "button";
    item.className = "entry-list__item";
    item.dataset.entryId = entry.id;
    const currentId = isFragments ? state.current?.id : state.currentTopic?.id;
    item.setAttribute("aria-current", String(currentId === entry.id));

    const title = document.createElement("span");
    title.className = "entry-list__title";
    title.textContent = entry.title || (isFragments ? "未命名碎片" : "未命名主题");

    const date = document.createElement("span");
    date.className = "entry-list__date";
    date.textContent = isFragments
      ? formatDate(entry.updated_at)
      : `${entry.fragment_count} 则碎片 · ${formatDate(entry.updated_at)}`;

    item.append(title, date);
    item.addEventListener("click", () => {
      if (isFragments) {
        void openEntry(entry.id);
      } else {
        void openTopic(entry.id);
      }
    });
    listItem.append(item);
    refs.entryList.append(listItem);
  }
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
  updateEditorActions();
  renderEntryList();
}

function showEmptyEditor() {
  if (state.workbenchMode === "fragments") {
    state.current = null;
    refs.editorEmptyIndex.textContent = "从一则碎片开始";
    refs.editorEmptyTitle.textContent = "今天想留下什么？";
    refs.editorEmptyCopy.textContent = "写下一个片段、一段路途，或某件还没有名字的事。";
    refs.emptyNewButton.textContent = "写一则碎片";
  } else {
    state.currentTopic = null;
    refs.editorEmptyIndex.textContent = "从碎片中发现联系";
    refs.editorEmptyTitle.textContent = "哪些事情似乎在谈论同一个问题？";
    refs.editorEmptyCopy.textContent = "选择至少一则碎片，写下它们之间的关联、矛盾或重复出现的意象。";
    refs.emptyNewButton.textContent = "整理第一则主题";
  }
  state.dirty = false;
  refs.editorPanel.hidden = true;
  refs.topicPanel.hidden = true;
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
  state.workbenchMode = "fragments";
  showEditor({ id: null, title: "", body: "", updated_at: null });
  state.dirty = true;
  updateSaveState("尚未保存", "dirty");
  updateEditorActions();
  refs.entryTitle.focus();
}

async function loadEntries() {
  const data = await api("/api/entries");
  state.entries = data.entries;
  state.entriesLoaded = true;
  renderEntryList();
}

async function loadTopics() {
  const data = await api("/api/topics");
  state.topics = data.topics;
  state.topicsLoaded = true;
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
    handleAppError(error, "无法打开这则碎片笔记。");
  } finally {
    setBusy(false);
  }
}

function showTopic(topic) {
  state.currentTopic = topic;
  state.dirty = false;
  refs.editorEmpty.hidden = true;
  refs.editorPanel.hidden = true;
  refs.topicPanel.hidden = false;
  window.scrollTo({ top: 0, left: 0 });
  refs.topicPanel.parentElement.scrollTop = 0;
  refs.topicDate.textContent = `最近整理：${formatDate(topic.updated_at)}`;
  refs.topicTitle.textContent = topic.title;
  refs.topicBody.textContent = topic.body || "这则主题暂时只有被选中的碎片，还没有写下解释。";
  refs.topicSourceList.replaceChildren();
  for (const fragment of topic.fragments) {
    const source = document.createElement("article");
    source.className = "topic-source";
    const title = document.createElement("h4");
    title.textContent = fragment.title;
    const body = document.createElement("p");
    body.textContent = fragment.body || "（这则碎片没有正文。）";
    source.append(title, body);
    refs.topicSourceList.append(source);
  }
  renderEntryList();
}

async function openTopic(topicId, { force = false } = {}) {
  if (!force && (state.busy || !canLeaveCurrentDraft())) {
    return;
  }
  setBusy(true);
  try {
    const data = await api(`/api/topics/${topicId}`);
    showTopic(data.topic);
  } catch (error) {
    handleAppError(error, "无法打开这则主题笔记。");
  } finally {
    setBusy(false);
  }
}

async function switchWorkbenchMode(mode) {
  if (mode === state.workbenchMode || !canLeaveCurrentDraft()) {
    return;
  }
  state.workbenchMode = mode;
  refs.fragmentTab.setAttribute("aria-pressed", String(mode === "fragments"));
  refs.topicTab.setAttribute("aria-pressed", String(mode === "topics"));
  refs.newEntryButton.hidden = mode !== "fragments";
  refs.newTopicButton.hidden = mode !== "topics";
  renderEntryList();

  if (mode === "fragments") {
    if (state.current?.id) {
      showEditor(state.current);
    } else if (state.entries[0]) {
      await openEntry(state.entries[0].id, { force: true });
    } else {
      showEmptyEditor();
    }
    return;
  }

  if (!state.topicsLoaded) {
    setBusy(true);
    try {
      await loadTopics();
    } catch (error) {
      handleAppError(error, "无法读取主题笔记。");
      showEmptyEditor();
      return;
    } finally {
      setBusy(false);
    }
  }
  if (state.currentTopic?.id) {
    showTopic(state.currentTopic);
  } else if (state.topics[0]) {
    await openTopic(state.topics[0].id);
  } else {
    showEmptyEditor();
  }
}

function renderTopicFragmentOptions(selectedIds = []) {
  const selected = new Set(selectedIds);
  refs.topicFragmentOptions.replaceChildren();
  for (const fragment of state.entries) {
    const label = document.createElement("label");
    label.className = "source-picker__option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "topic-fragment";
    input.value = fragment.id;
    input.checked = selected.has(fragment.id);
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = fragment.title;
    const date = document.createElement("small");
    date.textContent = formatDate(fragment.updated_at);
    copy.append(title, date);
    label.append(input, copy);
    refs.topicFragmentOptions.append(label);
  }
}

function openTopicDialog(topic = null) {
  if (!state.entries.length) {
    showMessage("先写下一则碎片，再开始整理主题。", "error");
    return;
  }
  setTopicFormError();
  refs.topicDialogTitle.textContent = topic ? "调整这则主题" : "把碎片放在一起";
  refs.topicId.value = topic?.id ?? "";
  refs.topicTitleInput.value = topic?.title ?? "";
  refs.topicBodyInput.value = topic?.body ?? "";
  renderTopicFragmentOptions(topic?.fragments?.map((fragment) => fragment.id) ?? []);
  refs.topicDialog.showModal();
  refs.topicTitleInput.focus();
}

async function saveTopic(event) {
  event.preventDefault();
  if (state.busy) return;
  const fragmentIds = [...refs.topicFragmentOptions.querySelectorAll("input:checked")]
    .map((input) => input.value);
  if (!fragmentIds.length) {
    setTopicFormError("请至少选择一则碎片笔记。");
    return;
  }

  setBusy(true);
  setTopicFormError();
  const topicId = refs.topicId.value;
  try {
    const data = await api(topicId ? `/api/topics/${topicId}` : "/api/topics", {
      method: topicId ? "PUT" : "POST",
      body: JSON.stringify({
        title: refs.topicTitleInput.value,
        body: refs.topicBodyInput.value,
        fragment_ids: fragmentIds,
      }),
    });
    refs.topicDialog.close();
    state.workbenchMode = "topics";
    state.currentTopic = data.topic;
    await loadTopics();
    showTopic(data.topic);
    showMessage(topicId ? "主题已经更新。" : "主题已经建立，可以继续编纂成书。 ");
  } catch (error) {
    setTopicFormError(error instanceof Error ? error.message : "无法保存主题。");
  } finally {
    setBusy(false);
  }
}

async function removeCurrentTopic() {
  if (!state.currentTopic?.id || state.busy) return;
  const topicId = state.currentTopic.id;
  setBusy(true);
  try {
    await api(`/api/topics/${topicId}`, { method: "DELETE" });
    state.currentTopic = null;
    await loadTopics();
    if (state.topics[0]) {
      const data = await api(`/api/topics/${state.topics[0].id}`);
      showTopic(data.topic);
    } else {
      showEmptyEditor();
    }
    showMessage("主题已经删除，原始碎片仍然保留。 ");
  } catch (error) {
    handleAppError(error, "无法删除这则主题。");
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
    showMessage("碎片已经保存。");
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
    showMessage("碎片已经删除。");
  } catch (error) {
    handleAppError(error, "无法删除这则碎片。");
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
  window.location.assign("/cdn-cgi/access/logout");
}

async function deleteAccount(event) {
  event.preventDefault();
  const identitySource = state.user?.source;
  const expectedConfirmation = identitySource === "development" ? "RESET" : "DELETE";
  const confirmation = refs.deleteConfirmation.value.trim();
  if (confirmation !== expectedConfirmation) {
    setDeleteAccountError(`请输入 ${expectedConfirmation} 以确认。`);
    refs.deleteConfirmation.focus();
    return;
  }

  setBusy(true);
  try {
    await api("/api/account", {
      method: "DELETE",
      body: JSON.stringify({ confirmation: "DELETE" }),
    });
    refs.deleteAccountDialog.close();
    refs.deleteConfirmation.value = "";
    if (identitySource === "cloudflare-access") {
      window.location.assign("/cdn-cgi/access/logout");
      return;
    }
    await restoreSession();
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
    showAuth({
      title: "需要重新登录",
      status: "Cloudflare Access 会话已经失效。重新登录不会删除已有手记。",
      error: "请重新完成邮箱验证码登录。",
      canLogin: true,
    });
    return;
  }
  showMessage(error instanceof Error ? error.message : fallbackMessage, "error");
}

function showBooksView() {
  if (!state.user) return;
  refs.authView.hidden = true;
  refs.titleView.hidden = true;
  refs.introView.hidden = true;
  refs.sceneView.hidden = true;
  refs.appView.hidden = true;
  refs.booksView.hidden = false;
  window.scrollTo({ top: 0, left: 0 });
  refs.booksEmail.textContent = state.user.email;
}

function renderBookList() {
  refs.bookList.replaceChildren();
  refs.bookListEmpty.hidden = state.books.length !== 0;
  for (const book of state.books) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "book-list__item";
    item.setAttribute("role", "listitem");
    item.setAttribute("aria-current", String(state.currentBook?.id === book.id));
    const title = document.createElement("strong");
    title.textContent = book.title;
    const date = document.createElement("small");
    date.textContent = formatDate(book.created_at);
    item.append(title, date);
    item.addEventListener("click", () => void openBook(book.id));
    refs.bookList.append(item);
  }
}

function renderBookContent(content) {
  refs.bookContent.replaceChildren();
  let skippedBookTitle = false;
  for (const line of content.split("\n")) {
    let element;
    if (line.startsWith("### ")) {
      element = document.createElement("h3");
      element.textContent = line.slice(4);
    } else if (line.startsWith("## ")) {
      element = document.createElement("h2");
      element.textContent = line.slice(3);
    } else if (line.startsWith("# ")) {
      if (!skippedBookTitle) {
        skippedBookTitle = true;
        continue;
      }
      element = document.createElement("h1");
      element.textContent = line.slice(2);
    } else if (line === "---") {
      element = document.createElement("hr");
    } else if (line.trim()) {
      element = document.createElement("p");
      element.textContent = line;
    } else {
      continue;
    }
    refs.bookContent.append(element);
  }
}

function showBook(book) {
  state.currentBook = book;
  refs.bookEmpty.hidden = true;
  refs.bookReader.hidden = false;
  window.scrollTo({ top: 0, left: 0 });
  refs.bookReader.parentElement.scrollTop = 0;
  refs.bookDate.textContent = formatDate(book.created_at);
  refs.bookTitle.textContent = book.title;
  renderBookContent(book.content_snapshot);
  renderBookList();
}

function showEmptyBook() {
  state.currentBook = null;
  refs.bookReader.hidden = true;
  refs.bookEmpty.hidden = false;
  renderBookList();
}

async function loadBooks() {
  const data = await api("/api/books");
  state.books = data.books;
  state.booksLoaded = true;
  renderBookList();
}

async function openBook(bookId) {
  if (state.busy) return;
  setBusy(true);
  try {
    const data = await api(`/api/books/${bookId}`);
    showBook(data.book);
  } catch (error) {
    handleAppError(error, "无法打开这本书。");
  } finally {
    setBusy(false);
  }
}

async function openBookshelf() {
  if (!state.user || state.busy || !canLeaveCurrentDraft()) return;
  showBooksView();
  setBusy(true);
  try {
    await Promise.all([
      state.booksLoaded ? Promise.resolve() : loadBooks(),
      state.topicsLoaded ? Promise.resolve() : loadTopics(),
    ]);
    if (state.currentBook?.id) {
      showBook(state.currentBook);
    } else if (state.books[0]) {
      const data = await api(`/api/books/${state.books[0].id}`);
      showBook(data.book);
    } else {
      showEmptyBook();
    }
  } catch (error) {
    handleAppError(error, "无法读取书架。");
    showEmptyBook();
  } finally {
    setBusy(false);
  }
}

function renderBookTopicOptions() {
  refs.bookTopicOptions.replaceChildren();
  for (const topic of state.topics) {
    const label = document.createElement("label");
    label.className = "source-picker__option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "book-topic";
    input.value = topic.id;
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = topic.title;
    const count = document.createElement("small");
    count.textContent = `${topic.fragment_count} 则碎片`;
    copy.append(title, count);
    label.append(input, copy);
    refs.bookTopicOptions.append(label);
  }
}

async function openCompileBookDialog() {
  if (!state.topicsLoaded) {
    setBusy(true);
    try {
      await loadTopics();
    } catch (error) {
      handleAppError(error, "无法读取主题笔记。");
      return;
    } finally {
      setBusy(false);
    }
  }
  if (!state.topics.length) {
    showMessage("先在书桌整理出一则主题，再开始编纂。", "error");
    return;
  }
  setCompileBookError();
  refs.bookTitleInput.value = "";
  refs.bookPrefaceInput.value = "";
  renderBookTopicOptions();
  refs.compileBookDialog.showModal();
  refs.bookTitleInput.focus();
}

async function compileBook(event) {
  event.preventDefault();
  if (state.busy) return;
  const topicIds = [...refs.bookTopicOptions.querySelectorAll("input:checked")]
    .map((input) => input.value);
  if (!topicIds.length) {
    setCompileBookError("请至少选择一则主题笔记。");
    return;
  }
  setBusy(true);
  setCompileBookError();
  try {
    const data = await api("/api/books", {
      method: "POST",
      body: JSON.stringify({
        title: refs.bookTitleInput.value,
        preface: refs.bookPrefaceInput.value,
        topic_ids: topicIds,
      }),
    });
    refs.compileBookDialog.close();
    state.currentBook = data.book;
    await loadBooks();
    showBooksView();
    showBook(data.book);
    showMessage("新书已经装订并放上书架。 ");
  } catch (error) {
    setCompileBookError(error instanceof Error ? error.message : "无法完成编纂。");
  } finally {
    setBusy(false);
  }
}

async function removeCurrentBook() {
  if (!state.currentBook?.id || state.busy) return;
  const bookId = state.currentBook.id;
  setBusy(true);
  try {
    await api(`/api/books/${bookId}`, { method: "DELETE" });
    state.currentBook = null;
    await loadBooks();
    if (state.books[0]) {
      const data = await api(`/api/books/${state.books[0].id}`);
      showBook(data.book);
    } else {
      showEmptyBook();
    }
    showMessage("这本书已经从书架移除。 ");
  } catch (error) {
    handleAppError(error, "无法移除这本书。");
  } finally {
    setBusy(false);
  }
}

async function loadLetters() {
  const data = await api("/api/letters");
  state.letters = data.letters;
}

function renderLetterSelect(selectedDay) {
  refs.letterSelect.replaceChildren();
  for (const letter of state.letters) {
    const option = document.createElement("option");
    option.value = String(letter.day);
    option.textContent = `第 ${letter.day} 天 · ${letter.title}${letter.opened_at ? "" : " · 新"}`;
    option.selected = letter.day === selectedDay;
    refs.letterSelect.append(option);
  }
}

async function openJourneyLetter(day = state.journey?.current_day ?? 1) {
  if (state.busy) return;
  setBusy(true);
  try {
    if (!state.letters.length) await loadLetters();
    const data = await api(`/api/letters/${day}/open`, { method: "PUT" });
    const summary = state.letters.find((letter) => letter.day === day);
    if (summary) summary.opened_at = data.letter.opened_at;
    refs.letterDay.textContent = `第 ${data.letter.day} 天来信`;
    refs.letterTitle.textContent = data.letter.title;
    refs.letterSender.textContent = `From: ${data.letter.sender}`;
    refs.letterContent.textContent = data.letter.content;
    renderLetterSelect(data.letter.day);
    if (!refs.letterDialog.open) refs.letterDialog.showModal();
  } catch (error) {
    handleAppError(error, "无法打开今天的来信。");
  } finally {
    setBusy(false);
  }
}

async function openWorkbench() {
  if (!state.user || state.busy) {
    return;
  }
  showApp(state.user);
  refs.fragmentTab.setAttribute("aria-pressed", String(state.workbenchMode === "fragments"));
  refs.topicTab.setAttribute("aria-pressed", String(state.workbenchMode === "topics"));
  refs.newEntryButton.hidden = state.workbenchMode !== "fragments";
  refs.newTopicButton.hidden = state.workbenchMode !== "topics";
  setBusy(true);
  try {
    if (!state.entriesLoaded) {
      await loadEntries();
    }
    if (state.workbenchMode === "topics") {
      if (!state.topicsLoaded) await loadTopics();
      if (state.currentTopic?.id) {
        showTopic(state.currentTopic);
      } else if (state.topics[0]) {
        await openTopic(state.topics[0].id, { force: true });
      } else {
        showEmptyEditor();
      }
    } else if (state.current?.id) {
      showEditor(state.current);
    } else if (state.entries[0]) {
      await openEntry(state.entries[0].id, { force: true });
    } else {
      showEmptyEditor();
    }
  } catch (error) {
    handleAppError(error, "无法读取写作台内容。");
  } finally {
    setBusy(false);
  }
}

function returnToRoom() {
  if (!canLeaveCurrentDraft()) {
    return;
  }
  showScene("room");
}

async function restoreSession() {
  showAuth();
  setBusy(true);
  try {
    const session = await api("/api/session");
    const journeyData = await api("/api/journey");
    showTitle(session.user, journeyData.journey);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      showAuth({
        title: "需要访问验证",
        status: "只有管理员加入允许名单的邮箱可以接收验证码并进入测试。",
        error: "当前访问身份无效或已经过期。",
        canLogin: true,
      });
      return;
    }
    showAuth({
      title: "暂时无法进入",
      status: "应用没有建立本地替代存档，以免与云端数据分叉。",
      error: error instanceof Error ? error.message : "暂时无法连接服务，请稍后重试。",
    });
  } finally {
    setBusy(false);
  }
}

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
refs.newTopicButton.addEventListener("click", () => openTopicDialog());
refs.emptyNewButton.addEventListener("click", () => {
  if (state.workbenchMode === "fragments") beginNewEntry();
  else openTopicDialog();
});
refs.fragmentTab.addEventListener("click", () => void switchWorkbenchMode("fragments"));
refs.topicTab.addEventListener("click", () => void switchWorkbenchMode("topics"));
refs.saveButton.addEventListener("click", () => void saveCurrentEntry());
refs.deleteEntryButton.addEventListener("click", () => refs.deleteEntryDialog.showModal());
refs.confirmDeleteEntry.addEventListener("click", () => void removeCurrentEntry());
refs.exportButton.addEventListener("click", () => void exportData());
refs.logoutButton.addEventListener("click", () => void logout());
refs.accessRetry.addEventListener("click", () => void restoreSession());
refs.journeyAction.addEventListener("click", () => void enterCurrentJourney());
refs.introNext.addEventListener("click", () => void advanceIntro());
refs.returnRoomButton.addEventListener("click", returnToRoom);
refs.booksReturnRoomButton.addEventListener("click", returnToRoom);
refs.editTopicButton.addEventListener("click", () => openTopicDialog(state.currentTopic));
refs.deleteTopicButton.addEventListener("click", () => refs.deleteTopicDialog.showModal());
refs.confirmDeleteTopic.addEventListener("click", () => void removeCurrentTopic());
refs.topicForm.addEventListener("submit", (event) => void saveTopic(event));
refs.cancelTopic.addEventListener("click", () => refs.topicDialog.close());
refs.compileBookButton.addEventListener("click", () => void openCompileBookDialog());
refs.emptyCompileBookButton.addEventListener("click", () => void openCompileBookDialog());
refs.compileBookForm.addEventListener("submit", (event) => void compileBook(event));
refs.cancelCompileBook.addEventListener("click", () => refs.compileBookDialog.close());
refs.deleteBookButton.addEventListener("click", () => refs.deleteBookDialog.showModal());
refs.confirmDeleteBook.addEventListener("click", () => void removeCurrentBook());
refs.letterSelect.addEventListener("change", () => void openJourneyLetter(Number(refs.letterSelect.value)));
refs.accountButton.addEventListener("click", openDeleteAccountDialog);
refs.titleAccountButton.addEventListener("click", openDeleteAccountDialog);
refs.sceneAccountButton.addEventListener("click", openDeleteAccountDialog);
refs.titleLogoutButton.addEventListener("click", () => void logout());
refs.sceneLogoutButton.addEventListener("click", () => void logout());
refs.cancelDeleteAccount.addEventListener("click", () => refs.deleteAccountDialog.close());
refs.deleteAccountForm.addEventListener("submit", (event) => void deleteAccount(event));
window.addEventListener("online", updateConnectivity);
window.addEventListener("offline", updateConnectivity);
window.addEventListener("beforeunload", (event) => {
  if (state.dirty) {
    event.preventDefault();
  }
});

showAuth();
void restoreSession();
