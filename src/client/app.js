import { createAccountFeature } from "./app/account-feature.js";
import { api, ApiClientError } from "./app/api-client.js";
import { queryAppElements } from "./app/dom.js";
import { createEntriesFeature } from "./app/entries-feature.js";
import { focusWhenReady } from "./app/format.js";
import { createJourneyFeature } from "./app/journey-feature.js";
import { createLibraryFeature } from "./app/library-feature.js";
import { createAppState } from "./app/state.js";
import { createTopicsFeature } from "./app/topics-feature.js";
import { createWorkbenchFeature } from "./app/workbench-feature.js";
import { createDialogueRuntime } from "./game/dialogue-runtime.js";
import { dialogues } from "./game/dialogues.js";
import { createSceneRegistry } from "./game/scene-registry.js";
import { createSceneRuntime } from "./game/scene-runtime.js";
import { doorwayScene } from "./game/scenes/doorway.js";
import { roomScene } from "./game/scenes/room.js";
import { createTimeService } from "./game/time-service.js";

const state = createAppState();
const refs = queryAppElements();

let accountFeature;
let entriesFeature;
let journeyFeature;
let libraryFeature;
let topicsFeature;
let workbenchFeature;

function renderSceneTime(snapshot) {
  document.documentElement.dataset.timePhase = snapshot.phase;
  document.documentElement.dataset.timeMode = snapshot.timeMode;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", snapshot.timeMode === "day" ? "#b9d8e5" : "#172231");
  refs.sceneDate.textContent = snapshot.dateLabel;
  refs.sceneWeekday.textContent = snapshot.weekdayLabel;
  refs.scenePhase.textContent = snapshot.phaseLabel;
  refs.sceneTime.setAttribute(
    "aria-label",
    `${snapshot.fullDateLabel}，${snapshot.phaseLabel}，${snapshot.timeModeLabel}模式`,
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
  refs.titleView.hidden = true;
  refs.authView.hidden = false;
  refs.accessTitle.textContent = title;
  refs.accessStatus.textContent = status;
  refs.accessRetry.hidden = false;
  refs.accessLogin.hidden = !canLogin;
  setAccessError(error);
}

function showTitle(user, journey) {
  state.user = user;
  state.journey = journey;
  refs.authView.hidden = true;
  refs.sceneView.hidden = true;
  refs.appView.hidden = true;
  refs.booksView.hidden = true;
  refs.titleView.hidden = false;
  refs.titleEmail.textContent = user.email;
  refs.titleLogoutButton.hidden = user.source !== "cloudflare-access";
  accountFeature.configureControls(user, journey);

  if (!journey) {
    refs.journeyActionLabel.textContent = "开始旅程";
    refs.journeyMeta.textContent = "从抵达陌生城市的这一天开始";
  } else if (journey.status === "completed") {
    refs.journeyActionLabel.textContent = "回到房间";
    refs.journeyMeta.textContent = "二十一天之后，书写仍在继续";
  } else {
    refs.journeyActionLabel.textContent = "继续旅程";
    refs.journeyMeta.textContent = `第 ${journey.current_day} 天 · 回到你的房间`;
  }
  focusWhenReady(refs.journeyAction);
}

function showScene(sceneId = "room", options = {}) {
  const journey = state.journey;
  if (!state.user || !journey) {
    return;
  }
  refs.authView.hidden = true;
  refs.titleView.hidden = true;
  refs.appView.hidden = true;
  refs.booksView.hidden = true;
  refs.sceneView.hidden = false;
  window.scrollTo({ top: 0, left: 0 });
  refs.sceneDay.textContent = journey.status === "completed" ? "旅程之后" : `第 ${journey.current_day} 天`;
  refs.sceneEmail.textContent = state.user.email;
  refs.sceneLogoutButton.hidden = state.user.source !== "cloudflare-access";
  sceneRuntime.show(sceneId, options);
}

function showApp(user) {
  state.user = user;
  refs.signedInEmail.textContent = user.email;
  refs.logoutButton.hidden = user.source !== "cloudflare-access";
  refs.authView.hidden = true;
  refs.titleView.hidden = true;
  refs.sceneView.hidden = true;
  refs.booksView.hidden = true;
  refs.appView.hidden = false;
  window.scrollTo({ top: 0, left: 0 });
  updateConnectivity();
}

function updateActions() {
  refs.saveButton.disabled = state.busy || !state.dirty;
  refs.deleteEntryButton.disabled = state.busy || !state.current?.id;
  refs.newEntryButton.disabled = state.busy;
  refs.newTopicButton.disabled = state.busy;
  refs.saveTopic.disabled = state.busy;
  refs.compileBookButton.disabled = state.busy;
  refs.emptyCompileBookButton.disabled = state.busy;
  refs.confirmCompileBook.disabled = state.busy;
}

function setBusy(busy) {
  state.busy = busy;
  refs.accessRetry.disabled = busy;
  refs.journeyAction.disabled = busy;
  refs.confirmDeleteAccount.disabled = busy;
  updateActions();
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

function showIntro() {
  showScene("doorway", { focus: false });
  sceneRuntime.openDialogue("journey.intro", {
    onConfirm: journeyFeature.completeIntro,
    onError: (error) => handleAppError(error, "暂时无法保存序章进度，请稍后重试。"),
  });
}

function returnToRoom() {
  if (!entriesFeature.canLeaveCurrentDraft()) {
    return;
  }
  showScene("room");
}

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
    openLetter: () => journeyFeature.openLetter(),
    openWorkbench: () => workbenchFeature.open(),
    openBookshelf: () => libraryFeature.open(),
  },
  onError: (error) => handleAppError(error, "场景交互暂时无法继续。"),
});

entriesFeature = createEntriesFeature({
  state,
  refs,
  api,
  setBusy,
  updateActions,
  renderList: () => workbenchFeature.renderList(),
  showEmptyEditor: () => workbenchFeature.showEmptyEditor(),
  showMessage,
  handleError: handleAppError,
});

topicsFeature = createTopicsFeature({
  state,
  refs,
  api,
  setBusy,
  renderList: () => workbenchFeature.renderList(),
  showEmptyEditor: () => workbenchFeature.showEmptyEditor(),
  showMessage,
  handleError: handleAppError,
  canLeaveCurrentDraft: entriesFeature.canLeaveCurrentDraft,
});

workbenchFeature = createWorkbenchFeature({
  state,
  refs,
  setBusy,
  showApp,
  handleError: handleAppError,
  entries: entriesFeature,
  topics: topicsFeature,
});

libraryFeature = createLibraryFeature({
  state,
  refs,
  api,
  setBusy,
  showMessage,
  handleError: handleAppError,
  canLeaveCurrentDraft: entriesFeature.canLeaveCurrentDraft,
  loadTopics: topicsFeature.loadTopics,
});

journeyFeature = createJourneyFeature({
  state,
  refs,
  api,
  setBusy,
  showAuth,
  showTitle,
  showScene,
  showIntro,
  handleError: handleAppError,
});

accountFeature = createAccountFeature({
  state,
  refs,
  api,
  setBusy,
  canLeaveCurrentDraft: entriesFeature.canLeaveCurrentDraft,
  restoreSession: () => journeyFeature.restoreSession(),
});

entriesFeature.bindEvents();
topicsFeature.bindEvents();
workbenchFeature.bindEvents();
libraryFeature.bindEvents();
journeyFeature.bindEvents();
accountFeature.bindEvents();

refs.returnRoomButton.addEventListener("click", returnToRoom);
refs.booksReturnRoomButton.addEventListener("click", returnToRoom);
window.addEventListener("online", updateConnectivity);
window.addEventListener("offline", updateConnectivity);
window.addEventListener("beforeunload", (event) => {
  if (state.dirty) {
    event.preventDefault();
  }
});

timeService.subscribe(renderSceneTime);
timeService.start();
showAuth();
void journeyFeature.restoreSession();
