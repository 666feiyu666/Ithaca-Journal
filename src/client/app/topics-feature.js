import { formatDate } from "./format.js";
import {
  autoArrangeTopicFragments,
  nextTopicPlacement,
  normalizeTopicFragment,
  pixelPosition,
  placementFromPointer,
  shapeVariantFor,
  toTopicLayoutPayload,
} from "./topic-layout.js";

const TOPIC_DRAG_TYPE = "application/x-ithaca-topic-fragment";
const PIECE_SIZE = Object.freeze({ width: 224, height: 152 });

export function setTopicDragAvailability(root, busy) {
  for (const piece of root.querySelectorAll(".topic-piece")) {
    piece.draggable = !busy;
  }
}

function excerptFor(fragment) {
  const content = fragment.excerpt ?? fragment.body ?? "";
  return content.trim().slice(0, 150) || "这张纸上只留下了一个题目。";
}

function writeDragData(event, payload) {
  const serialized = JSON.stringify(payload);
  event.dataTransfer.effectAllowed = "copyMove";
  event.dataTransfer.setData(TOPIC_DRAG_TYPE, serialized);
  event.dataTransfer.setData("text/plain", serialized);
}

function readDragData(event) {
  const serialized = event.dataTransfer.getData(TOPIC_DRAG_TYPE)
    || event.dataTransfer.getData("text/plain");
  if (!serialized) return null;
  try {
    const payload = JSON.parse(serialized);
    if (
      (payload.source === "tray" || payload.source === "board")
      && typeof payload.fragmentId === "string"
    ) {
      return payload;
    }
  } catch {
    return null;
  }
  return null;
}

export function createTopicsFeature({
  state,
  refs,
  api,
  setBusy,
  renderList,
  showEmptyEditor,
  showMessage,
  handleError,
  canLeaveCurrentDraft,
  closeTopicDirectory = () => {},
  openTopicDirectory = () => {},
}) {
  let resizeFrame = 0;

  function setTopicFormError(message = "") {
    refs.topicFormError.textContent = message;
    refs.topicFormError.hidden = !message;
  }

  function normalizeTopic(topic) {
    return {
      ...topic,
      fragments: topic.fragments.map((fragment, index) => (
        normalizeTopicFragment(fragment, index, topic.pattern_seed)
      )),
    };
  }

  function setLayoutState(message, stateName = "saved") {
    refs.topicLayoutState.textContent = message;
    refs.topicLayoutState.dataset.state = stateName;
  }

  function setLayoutBusy(busy) {
    state.topicLayoutBusy = busy;
    refs.topicPanel.classList.toggle("topic-layout-busy", busy);
    refs.autoArrangeTopicButton.disabled = busy || (state.currentTopic?.fragments.length ?? 0) < 2;
    for (const button of refs.topicPanel.querySelectorAll(
      ".topic-tray-card__add, .topic-piece__remove",
    )) {
      button.disabled = busy;
    }
    setTopicDragAvailability(refs.topicPanel, busy);
  }

  function positionPieces() {
    const boardWidth = refs.topicBoard.clientWidth;
    const boardHeight = refs.topicBoard.clientHeight;
    if (!boardWidth || !boardHeight || !state.currentTopic) return;
    const fragments = new Map(
      state.currentTopic.fragments.map((fragment) => [fragment.id, fragment]),
    );
    for (const piece of refs.topicPieceLayer.children) {
      const fragment = fragments.get(piece.dataset.fragmentId);
      if (!fragment) continue;
      const position = pixelPosition(
        fragment,
        { width: boardWidth, height: boardHeight },
        PIECE_SIZE,
      );
      piece.style.left = `${position.left}px`;
      piece.style.top = `${position.top}px`;
      piece.style.zIndex = String(fragment.z_index + 1);
    }
  }

  function schedulePiecePositioning() {
    if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      positionPieces();
    });
  }

  function renderTray() {
    if (!state.currentTopic) return;
    const selectedIds = new Set(state.currentTopic.fragments.map((fragment) => fragment.id));
    refs.topicTrayList.replaceChildren();
    refs.topicTrayCount.textContent = `${state.entries.length} 张纸 · ${selectedIds.size} 张已在画布`;
    refs.topicTrayEmpty.hidden = state.entries.length !== 0;

    for (const fragment of state.entries) {
      const inTopic = selectedIds.has(fragment.id);
      const card = document.createElement("article");
      card.className = "topic-tray-card";
      card.dataset.fragmentId = fragment.id;
      card.dataset.inTopic = String(inTopic);
      card.setAttribute("role", "listitem");
      card.draggable = !inTopic;

      const seal = document.createElement("span");
      seal.className = "topic-tray-card__seal";
      seal.setAttribute("aria-hidden", "true");

      const copy = document.createElement("div");
      copy.className = "topic-tray-card__copy";
      const title = document.createElement("strong");
      title.textContent = fragment.title || "没有题目的纸页";
      const excerpt = document.createElement("p");
      excerpt.textContent = excerptFor(fragment);
      const date = document.createElement("small");
      date.textContent = formatDate(fragment.updated_at);
      copy.append(title, excerpt, date);

      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "topic-tray-card__add";
      addButton.textContent = inTopic ? "已加入" : "加入主题";
      addButton.disabled = inTopic || state.topicLayoutBusy;
      addButton.addEventListener("click", () => void addFragmentToTopic(fragment.id));

      card.addEventListener("dragstart", (event) => {
        if (inTopic || state.topicLayoutBusy) {
          event.preventDefault();
          return;
        }
        writeDragData(event, { source: "tray", fragmentId: fragment.id });
      });
      card.addEventListener("dragend", clearDropStates);
      card.append(seal, copy, addButton);
      refs.topicTrayList.append(card);
    }
  }

  function focusPiece(fragmentId) {
    window.requestAnimationFrame(() => {
      for (const piece of refs.topicPieceLayer.children) {
        if (piece.dataset.fragmentId === fragmentId) {
          piece.focus();
          break;
        }
      }
    });
  }

  function renderBoard() {
    const fragments = state.currentTopic?.fragments ?? [];
    refs.topicBoardEmpty.hidden = fragments.length !== 0;
    refs.topicPieceLayer.replaceChildren();

    for (const fragment of fragments) {
      const piece = document.createElement("article");
      piece.className = "topic-piece";
      piece.dataset.fragmentId = fragment.id;
      piece.tabIndex = 0;
      piece.draggable = true;
      piece.setAttribute(
        "aria-label",
        `${fragment.title || "没有题目的纸页"}。可拖动，或使用方向键调整位置。`,
      );

      const folio = document.createElement("div");
      folio.className = "topic-piece__folio";
      const type = document.createElement("span");
      type.textContent = "LOOSE NOTE";
      const index = document.createElement("span");
      index.textContent = String(fragment.position + 1).padStart(2, "0");
      folio.append(type, index);

      const title = document.createElement("h4");
      title.textContent = fragment.title || "没有题目的纸页";
      const excerpt = document.createElement("p");
      excerpt.className = "topic-piece__excerpt";
      excerpt.textContent = excerptFor(fragment);
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "topic-piece__remove";
      removeButton.textContent = "移出主题";
      removeButton.disabled = state.topicLayoutBusy;
      removeButton.addEventListener("click", (event) => {
        event.stopPropagation();
        void removeFragmentFromTopic(fragment.id);
      });

      piece.addEventListener("dragstart", (event) => {
        if (state.topicLayoutBusy) {
          event.preventDefault();
          return;
        }
        writeDragData(event, { source: "board", fragmentId: fragment.id });
      });
      piece.addEventListener("dragend", clearDropStates);
      piece.addEventListener("keydown", (event) => {
        const movement = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        }[event.key];
        if (!movement || state.topicLayoutBusy) return;
        event.preventDefault();
        const step = event.shiftKey ? 0.1 : 0.025;
        void moveFragmentInTopic(fragment.id, {
          canvas_x: fragment.canvas_x + (movement[0] * step),
          canvas_y: fragment.canvas_y + (movement[1] * step),
        });
      });

      piece.append(folio, title, excerpt, removeButton);
      refs.topicPieceLayer.append(piece);
    }
    schedulePiecePositioning();
  }

  function renderWorkspace() {
    renderTray();
    renderBoard();
    const count = state.currentTopic?.fragments.length ?? 0;
    refs.topicMappingGate.textContent = count === 0
      ? "先放入笔记。达到设定数量后，才会开放 Placeholder 映射与拼图阶段。"
      : `当前已摆放 ${count} 则笔记；它们仍处于整理阶段，尚未转化为拼图片。`;
    setLayoutBusy(state.topicLayoutBusy);
  }

  function showTopic(topic) {
    state.currentTopic = normalizeTopic(topic);
    state.dirty = false;
    state.workbenchMode = "topics";
    closeTopicDirectory();
    refs.editorEmpty.hidden = true;
    refs.editorPanel.hidden = true;
    refs.topicPanel.hidden = false;
    window.scrollTo({ top: 0, left: 0 });
    refs.topicPanel.parentElement.scrollTop = 0;
    refs.topicDate.textContent = `最近整理：${formatDate(topic.updated_at)}`;
    refs.topicTitle.textContent = topic.title;
    refs.topicBody.textContent = topic.body || "还没有写下主题说明；可以先在画布上看看这些碎片如何靠近。";
    setLayoutState("布局已保存");
    renderWorkspace();
    renderList();
  }

  async function loadTopics() {
    const data = await api("/api/topics");
    state.topics = data.topics;
    state.topicsLoaded = true;
    renderList();
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
      handleError(error, "无法打开这则主题笔记。");
    } finally {
      setBusy(false);
    }
  }

  function openTopicDialog(topic = null) {
    setTopicFormError();
    refs.topicDialogTitle.textContent = topic ? "调整这个主题" : "先为这个主题留一个位置";
    refs.topicId.value = topic?.id ?? "";
    refs.topicTitleInput.value = topic?.title ?? "";
    refs.topicBodyInput.value = topic?.body ?? "";
    refs.saveTopic.textContent = topic ? "保存主题说明" : "创建并进入画布";
    refs.topicDialog.showModal();
    refs.topicTitleInput.focus();
  }

  async function saveTopic(event) {
    event.preventDefault();
    if (state.busy) return;
    setBusy(true);
    setTopicFormError();
    const topicId = refs.topicId.value;
    try {
      const data = await api(topicId ? `/api/topics/${topicId}` : "/api/topics", {
        method: topicId ? "PUT" : "POST",
        body: JSON.stringify({
          title: refs.topicTitleInput.value,
          body: refs.topicBodyInput.value,
        }),
      });
      refs.topicDialog.close();
      state.workbenchMode = "topics";
      state.currentTopic = data.topic;
      await loadTopics();
      showTopic(data.topic);
      showMessage(topicId ? "主题说明已经更新。" : "主题已经建立，从左侧取一张碎片开始吧。");
    } catch (error) {
      setTopicFormError(error instanceof Error ? error.message : "无法保存主题。");
    } finally {
      setBusy(false);
    }
  }

  async function persistLayout(nextFragments, previousFragments, focusId = "") {
    if (!state.currentTopic?.id || state.topicLayoutBusy || state.busy) return;
    const topicId = state.currentTopic.id;
    state.currentTopic = { ...state.currentTopic, fragments: nextFragments };
    setLayoutState("正在自动保存…", "dirty");
    renderWorkspace();
    setLayoutBusy(true);
    try {
      const data = await api(`/api/topics/${topicId}/layout`, {
        method: "PUT",
        body: JSON.stringify(toTopicLayoutPayload(nextFragments)),
      });
      state.currentTopic = normalizeTopic(data.topic);
      await loadTopics();
      setLayoutState("布局已自动保存");
      renderWorkspace();
      if (focusId) focusPiece(focusId);
    } catch (error) {
      state.currentTopic = { ...state.currentTopic, fragments: previousFragments };
      setLayoutState("布局保存失败", "error");
      renderWorkspace();
      handleError(error, "无法保存主题布局。");
    } finally {
      setLayoutBusy(false);
    }
  }

  async function addFragmentToTopic(fragmentId, placement = null) {
    if (!state.currentTopic || state.currentTopic.fragments.some(({ id }) => id === fragmentId)) {
      return;
    }
    if (state.currentTopic.fragments.length >= 50) {
      showMessage("一个主题最多放入 50 则碎片。", "error");
      return;
    }
    const source = state.entries.find(({ id }) => id === fragmentId);
    if (!source) {
      showMessage("没有找到这张碎片纸页。", "error");
      return;
    }
    const previous = state.currentTopic.fragments;
    const defaultPlacement = nextTopicPlacement(previous.length);
    const nextFragment = normalizeTopicFragment({
      ...source,
      body: source.body ?? source.excerpt ?? "",
      ...defaultPlacement,
      ...placement,
      position: previous.length,
      shape_variant: shapeVariantFor(state.currentTopic.pattern_seed, source.id),
    }, previous.length, state.currentTopic.pattern_seed);
    await persistLayout([...previous, nextFragment], previous, fragmentId);
  }

  async function moveFragmentInTopic(fragmentId, placement) {
    if (!state.currentTopic) return;
    const previous = state.currentTopic.fragments;
    const highestZ = previous.reduce((maximum, fragment) => Math.max(maximum, fragment.z_index), 0);
    const next = previous.map((fragment) => (
      fragment.id === fragmentId
        ? normalizeTopicFragment({ ...fragment, ...placement, z_index: highestZ + 1 })
        : fragment
    ));
    await persistLayout(next, previous, fragmentId);
  }

  async function removeFragmentFromTopic(fragmentId) {
    if (!state.currentTopic) return;
    const previous = state.currentTopic.fragments;
    const next = previous
      .filter((fragment) => fragment.id !== fragmentId)
      .map((fragment, position) => ({ ...fragment, position }));
    await persistLayout(next, previous);
  }

  async function autoArrangeCurrentTopic() {
    if (!state.currentTopic || state.currentTopic.fragments.length < 2) return;
    const previous = state.currentTopic.fragments;
    const next = autoArrangeTopicFragments(previous)
      .map((fragment, position) => ({ ...fragment, position }));
    await persistLayout(next, previous);
  }

  function clearDropStates() {
    refs.topicBoard.dataset.dropActive = "false";
    refs.topicFragmentTray.dataset.dropActive = "false";
  }

  function bindCanvasEvents() {
    refs.topicBoard.addEventListener("dragover", (event) => {
      if (state.topicLayoutBusy) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      refs.topicBoard.dataset.dropActive = "true";
    });
    refs.topicBoard.addEventListener("dragleave", (event) => {
      if (!refs.topicBoard.contains(event.relatedTarget)) {
        refs.topicBoard.dataset.dropActive = "false";
      }
    });
    refs.topicBoard.addEventListener("drop", (event) => {
      event.preventDefault();
      const payload = readDragData(event);
      clearDropStates();
      if (!payload || state.topicLayoutBusy) return;
      const placement = placementFromPointer(
        event,
        refs.topicBoard.getBoundingClientRect(),
        PIECE_SIZE,
      );
      if (payload.source === "tray") {
        void addFragmentToTopic(payload.fragmentId, placement);
      } else {
        void moveFragmentInTopic(payload.fragmentId, placement);
      }
    });

    refs.topicFragmentTray.addEventListener("dragover", (event) => {
      if (state.topicLayoutBusy) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      refs.topicFragmentTray.dataset.dropActive = "true";
    });
    refs.topicFragmentTray.addEventListener("dragleave", (event) => {
      if (!refs.topicFragmentTray.contains(event.relatedTarget)) {
        refs.topicFragmentTray.dataset.dropActive = "false";
      }
    });
    refs.topicFragmentTray.addEventListener("drop", (event) => {
      event.preventDefault();
      const payload = readDragData(event);
      clearDropStates();
      if (payload?.source === "board") {
        void removeFragmentFromTopic(payload.fragmentId);
      }
    });
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
        openTopicDirectory();
      }
      showMessage("主题已经删除，原始碎片仍然保留。");
    } catch (error) {
      handleError(error, "无法删除这则主题。");
    } finally {
      setBusy(false);
    }
  }

  function bindEvents() {
    refs.editTopicButton.addEventListener("click", () => openTopicDialog(state.currentTopic));
    refs.autoArrangeTopicButton.addEventListener("click", () => void autoArrangeCurrentTopic());
    refs.deleteTopicButton.addEventListener("click", () => refs.deleteTopicDialog.showModal());
    refs.confirmDeleteTopic.addEventListener("click", () => void removeCurrentTopic());
    refs.topicForm.addEventListener("submit", (event) => void saveTopic(event));
    refs.cancelTopic.addEventListener("click", () => refs.topicDialog.close());
    bindCanvasEvents();
    window.addEventListener("resize", schedulePiecePositioning);
  }

  return Object.freeze({
    bindEvents,
    loadTopics,
    openTopic,
    openTopicDialog,
    showTopic,
  });
}
