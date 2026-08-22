import { formatDate } from "./format.js";
import {
  createPuzzlePreview,
  createPuzzleShape,
  fitPuzzleShapes,
} from "./puzzle-shape.js";
import {
  assignPuzzleSlots,
  autoArrangeTopicFragments,
  nextTopicPlacement,
  normalizeTopicFragment,
  pixelPosition,
  placementFromPointer,
  puzzlePieceMetrics,
  shapeVariantFor,
  snapPuzzlePlacement,
  toTopicLayoutPayload,
} from "./topic-layout.js";
import { puzzleDefinitionFor } from "../config/puzzles.js";

const TOPIC_DRAG_TYPE = "application/x-ithaca-topic-fragment";
const PIECE_SIZE = Object.freeze({ width: 224, height: 168 });

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
  let puzzleShop = [];
  let puzzleShopBusy = false;
  let detailFragmentId = "";

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
    refs.openPuzzleShopButton.disabled = busy;
    for (const button of refs.topicPanel.querySelectorAll(
      ".topic-tray-card__add, .topic-piece__remove, .puzzle-product-card__action",
    )) {
      button.disabled = busy;
    }
    setTopicDragAvailability(refs.topicPanel, busy);
  }

  function positionPieces() {
    const boardWidth = refs.topicBoard.clientWidth;
    const boardHeight = refs.topicBoard.clientHeight;
    if (!boardWidth || !boardHeight || !state.currentTopic) return;
    const boardSize = { width: boardWidth, height: boardHeight };
    const activePuzzle = puzzleDefinitionFor(state.currentTopic.active_puzzle_id);
    const fragments = new Map(
      state.currentTopic.fragments.map((fragment) => [fragment.id, fragment]),
    );
    for (const piece of refs.topicPieceLayer.children) {
      const fragment = fragments.get(piece.dataset.fragmentId);
      if (!fragment) continue;
      const puzzlePiece = activePuzzle && fragment.position < activePuzzle.pieceCount
        ? activePuzzle.pieces[fragment.shape_variant]
        : null;
      let pieceSize = PIECE_SIZE;
      let position;
      if (puzzlePiece) {
        const metrics = puzzlePieceMetrics(
          puzzlePiece.bounds,
          activePuzzle.canvas,
          boardSize,
        );
        pieceSize = { width: metrics.width, height: metrics.height };
        piece.style.width = `${metrics.width}px`;
        piece.style.height = `${metrics.height}px`;
        position = fragment.is_snapped
          ? metrics
          : pixelPosition(fragment, boardSize, pieceSize);
        piece.classList.toggle("topic-piece--snapped", fragment.is_snapped);
      } else {
        position = pixelPosition(fragment, boardSize, pieceSize);
      }
      piece.style.left = `${position.left}px`;
      piece.style.top = `${position.top}px`;
      piece.style.zIndex = String(fragment.z_index + 1);
    }
    fitPuzzleShapes(refs.topicPieceLayer);
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
    const activePuzzle = puzzleDefinitionFor(state.currentTopic?.active_puzzle_id);
    refs.topicBoardEmpty.hidden = fragments.length !== 0;
    refs.topicPieceLayer.replaceChildren();

    for (const fragment of fragments) {
      const mapped = Boolean(activePuzzle && fragment.position < activePuzzle.pieceCount);
      const piece = document.createElement("article");
      piece.className = "topic-piece";
      piece.classList.toggle("topic-piece--mapped", mapped);
      piece.classList.toggle("topic-piece--waiting", Boolean(activePuzzle && !mapped));
      piece.dataset.fragmentId = fragment.id;
      piece.tabIndex = 0;
      piece.draggable = true;
      piece.title = mapped ? "拖动拼接；双击查看这则碎片" : "拖动纸页；双击查看全文";
      piece.setAttribute(
        "aria-label",
        `${fragment.title || "没有题目的纸页"}。${mapped ? "已映射为拼片。" : "仍是散页。"}可拖动，或使用方向键调整位置。`,
      );

      const shape = mapped
        ? createPuzzleShape(activePuzzle.id, fragment.shape_variant)
        : null;

      const folio = document.createElement("div");
      folio.className = "topic-piece__folio";
      const type = document.createElement("span");
      type.textContent = mapped ? "STORY PIECE" : "LOOSE NOTE";
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
      piece.addEventListener("dblclick", (event) => {
        event.preventDefault();
        openPieceDetail(fragment);
      });
      piece.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          openPieceDetail(fragment);
          return;
        }
        const movement = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        }[event.key];
        if (!movement || state.topicLayoutBusy) return;
        event.preventDefault();
        const step = event.shiftKey ? 0.1 : 0.025;
        const puzzlePiece = activePuzzle?.pieces[fragment.shape_variant];
        const snappedMetrics = fragment.is_snapped && puzzlePiece
          ? puzzlePieceMetrics(
            puzzlePiece.bounds,
            activePuzzle.canvas,
            {
              width: refs.topicBoard.clientWidth,
              height: refs.topicBoard.clientHeight,
            },
          )
          : null;
        void moveFragmentInTopic(fragment.id, {
          canvas_x: (snappedMetrics?.canvas_x ?? fragment.canvas_x) + (movement[0] * step),
          canvas_y: (snappedMetrics?.canvas_y ?? fragment.canvas_y) + (movement[1] * step),
        });
      });

      piece.append(...(shape ? [shape] : []), folio, title, excerpt, removeButton);
      refs.topicPieceLayer.append(piece);
    }
    schedulePiecePositioning();
  }

  function renderWorkspace() {
    renderTray();
    renderBoard();
    const count = state.currentTopic?.fragments.length ?? 0;
    const activePuzzle = puzzleDefinitionFor(state.currentTopic?.active_puzzle_id);
    refs.activePuzzleLabel.textContent = activePuzzle?.title ?? "散页模式";
    refs.autoArrangeTopicButton.textContent = activePuzzle ? "自动拼合" : "自动整理";
    if (!activePuzzle) {
      refs.topicMappingGate.textContent = count === 0
        ? "先放入碎片笔记，再去商店查看可以兑换的拼图。"
        : `画布已有 ${count} 则碎片；数量是兑换门槛，文字不会被消耗。`;
    } else {
      const mappedCount = Math.min(count, activePuzzle.pieceCount);
      const snappedCount = state.currentTopic.fragments
        .filter((fragment) => fragment.position < activePuzzle.pieceCount && fragment.is_snapped)
        .length;
      const waitingCount = Math.max(0, count - activePuzzle.pieceCount);
      refs.topicMappingGate.textContent = waitingCount
        ? `${activePuzzle.title}已吸附 ${snappedCount} / ${mappedCount} 片；另外 ${waitingCount} 则仍作为散页保留。`
        : `${activePuzzle.title}已吸附 ${snappedCount} / ${mappedCount} 片。拖近正确位置会自动扣合。`;
    }
    setLayoutBusy(state.topicLayoutBusy);
  }

  function openPieceDetail(fragment) {
    detailFragmentId = fragment.id;
    refs.pieceDetailTitle.textContent = fragment.title || "没有题目的纸页";
    refs.pieceDetailMeta.textContent = `第 ${fragment.position + 1} 则 · ${formatDate(fragment.updated_at)}`;
    refs.pieceDetailBody.textContent = fragment.body || fragment.excerpt || "这张纸上还没有正文。";
    refs.pieceDetailDialog.showModal();
  }

  function renderPuzzleShop() {
    const count = state.currentTopic?.fragments.length ?? 0;
    refs.puzzleShopContext.textContent = puzzleShopBusy
      ? "正在清点画布与已经拥有的拼图……"
      : `当前主题画布有 ${count} 则碎片笔记。`;
    refs.puzzleShopList.replaceChildren();

    const looseCard = document.createElement("article");
    looseCard.className = "puzzle-product-card puzzle-product-card--loose";
    looseCard.setAttribute("role", "listitem");
    const looseVisual = document.createElement("div");
    looseVisual.className = "puzzle-product-card__loose-preview";
    looseVisual.setAttribute("aria-hidden", "true");
    looseVisual.textContent = "散页";
    const looseCopy = document.createElement("div");
    looseCopy.className = "puzzle-product-card__copy";
    const looseTitle = document.createElement("h3");
    looseTitle.textContent = "散页画布";
    const looseDescription = document.createElement("p");
    looseDescription.textContent = "保留自由摆放的纸页，不套用任何拼图轮廓。";
    const looseState = document.createElement("small");
    looseState.textContent = state.currentTopic?.active_puzzle_id ? "随时可以切回" : "当前正在使用";
    looseCopy.append(looseTitle, looseDescription, looseState);
    const looseButton = document.createElement("button");
    looseButton.type = "button";
    looseButton.className = "button button--quiet puzzle-product-card__action";
    looseButton.textContent = state.currentTopic?.active_puzzle_id ? "切回散页" : "使用中";
    looseButton.disabled = puzzleShopBusy || !state.currentTopic?.active_puzzle_id;
    looseButton.addEventListener("click", () => void activatePuzzle(null));
    looseCard.append(looseVisual, looseCopy, looseButton);
    refs.puzzleShopList.append(looseCard);

    for (const product of puzzleShop) {
      const card = document.createElement("article");
      card.className = "puzzle-product-card";
      card.dataset.state = product.active
        ? "active"
        : product.owned
          ? "owned"
          : product.eligible
            ? "eligible"
            : "locked";
      card.setAttribute("role", "listitem");

      const preview = createPuzzlePreview(product.id);
      if (preview) card.append(preview);
      const copy = document.createElement("div");
      copy.className = "puzzle-product-card__copy";
      const title = document.createElement("h3");
      title.textContent = product.title;
      const description = document.createElement("p");
      description.textContent = product.description;
      const progress = document.createElement("small");
      if (product.active) {
        progress.textContent = "已经拥有 · 当前主题使用中";
      } else if (product.owned) {
        progress.textContent = "已经拥有 · 可以随时切换";
      } else if (product.eligible) {
        progress.textContent = `${count} / ${product.piece_count} · 已达到兑换条件`;
      } else {
        progress.textContent = `${count} / ${product.piece_count} · 还差 ${product.remaining_fragments} 则`;
      }
      copy.append(title, description, progress);

      const action = document.createElement("button");
      action.type = "button";
      action.className = "button button--primary puzzle-product-card__action";
      action.disabled = puzzleShopBusy || product.active || (!product.owned && !product.eligible);
      action.textContent = product.active
        ? "使用中"
        : product.owned
          ? "使用这套"
          : product.eligible
            ? `兑换并使用 ${product.piece_count} 片`
            : `还差 ${product.remaining_fragments} 则`;
      action.addEventListener("click", () => {
        if (product.owned) void activatePuzzle(product.id);
        else void purchasePuzzleProduct(product.id);
      });
      card.append(copy, action);
      refs.puzzleShopList.append(card);
    }
  }

  async function loadPuzzleShop({ reportError = false } = {}) {
    if (!state.currentTopic?.id) return;
    const topicId = state.currentTopic.id;
    try {
      const data = await api(`/api/puzzles?topic_id=${encodeURIComponent(topicId)}`);
      if (state.currentTopic?.id !== topicId) return;
      puzzleShop = data.puzzles;
      renderPuzzleShop();
    } catch (error) {
      if (reportError) handleError(error, "无法打开拼图商店。");
    }
  }

  async function openPuzzleShop() {
    if (!state.currentTopic?.id || puzzleShopBusy) return;
    refs.puzzleShopDialog.showModal();
    puzzleShopBusy = true;
    renderPuzzleShop();
    await loadPuzzleShop({ reportError: true });
    puzzleShopBusy = false;
    renderPuzzleShop();
  }

  async function applyPuzzleChange(request, message) {
    if (!state.currentTopic?.id || puzzleShopBusy) return;
    puzzleShopBusy = true;
    setLayoutBusy(true);
    renderPuzzleShop();
    try {
      const data = await request();
      state.currentTopic = normalizeTopic(data.topic);
      puzzleShop = data.puzzles;
      await loadTopics();
      renderWorkspace();
      renderPuzzleShop();
      showMessage(message);
    } catch (error) {
      handleError(error, "无法切换这套拼图。");
    } finally {
      puzzleShopBusy = false;
      setLayoutBusy(false);
      renderPuzzleShop();
    }
  }

  async function purchasePuzzleProduct(puzzleId) {
    const topicId = state.currentTopic?.id;
    if (!topicId) return;
    await applyPuzzleChange(
      () => api(`/api/puzzles/${puzzleId}/purchase`, {
        method: "POST",
        body: JSON.stringify({ topic_id: topicId }),
      }),
      "拼图已经永久收藏，并应用到当前主题。",
    );
  }

  async function activatePuzzle(puzzleId) {
    const topicId = state.currentTopic?.id;
    if (!topicId) return;
    await applyPuzzleChange(
      () => api(`/api/topics/${topicId}/puzzle`, {
        method: "PUT",
        body: JSON.stringify({ puzzle_id: puzzleId }),
      }),
      puzzleId ? "已经切换到这套拼图。" : "已经切回散页画布。",
    );
  }

  function showTopic(topic) {
    state.currentTopic = normalizeTopic(topic);
    puzzleShop = [];
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
    void loadPuzzleShop();
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
      await loadPuzzleShop();
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
    const activePuzzle = puzzleDefinitionFor(state.currentTopic.active_puzzle_id);
    const nextFragment = normalizeTopicFragment({
      ...source,
      body: source.body ?? source.excerpt ?? "",
      ...defaultPlacement,
      ...placement,
      position: previous.length,
      shape_variant: activePuzzle
        ? previous.length % activePuzzle.pieceCount
        : shapeVariantFor(state.currentTopic.pattern_seed, source.id),
      is_snapped: false,
    }, previous.length, state.currentTopic.pattern_seed);
    const next = activePuzzle
      ? assignPuzzleSlots([...previous, nextFragment], activePuzzle.pieceCount)
      : [...previous, nextFragment];
    await persistLayout(next, previous, fragmentId);
  }

  async function moveFragmentInTopic(fragmentId, placement) {
    if (!state.currentTopic) return;
    const previous = state.currentTopic.fragments;
    const highestZ = previous.reduce((maximum, fragment) => Math.max(maximum, fragment.z_index), 0);
    const next = previous.map((fragment) => (
      fragment.id === fragmentId
        ? normalizeTopicFragment({
          ...fragment,
          ...placement,
          is_snapped: placement.is_snapped === true,
          z_index: highestZ + 1,
        })
        : fragment
    ));
    await persistLayout(next, previous, fragmentId);
  }

  async function removeFragmentFromTopic(fragmentId) {
    if (!state.currentTopic) return;
    const previous = state.currentTopic.fragments;
    const activePuzzle = puzzleDefinitionFor(state.currentTopic.active_puzzle_id);
    const remaining = previous
      .filter((fragment) => fragment.id !== fragmentId)
      .sort((left, right) => left.position - right.position)
      .map((fragment, position) => ({ ...fragment, position }));
    const next = activePuzzle
      ? assignPuzzleSlots(remaining, activePuzzle.pieceCount)
      : remaining;
    await persistLayout(next, previous);
  }

  async function autoArrangeCurrentTopic() {
    if (!state.currentTopic || state.currentTopic.fragments.length < 2) return;
    const previous = state.currentTopic.fragments;
    const activePuzzle = puzzleDefinitionFor(state.currentTopic.active_puzzle_id);
    const next = activePuzzle
      ? assignPuzzleSlots(previous, activePuzzle.pieceCount).map((fragment) => {
        const piece = fragment.position < activePuzzle.pieceCount
          ? activePuzzle.pieces[fragment.shape_variant]
          : null;
        if (!piece) return { ...fragment, is_snapped: false };
        const metrics = puzzlePieceMetrics(
          piece.bounds,
          activePuzzle.canvas,
          {
            width: refs.topicBoard.clientWidth,
            height: refs.topicBoard.clientHeight,
          },
        );
        return {
          ...fragment,
          canvas_x: metrics.canvas_x,
          canvas_y: metrics.canvas_y,
          is_snapped: true,
        };
      })
      : autoArrangeTopicFragments(previous)
        .map((fragment, position) => ({ ...fragment, position, is_snapped: false }));
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
        payload.source === "board"
          ? (() => {
            const element = refs.topicPieceLayer.querySelector(
              `[data-fragment-id="${CSS.escape(payload.fragmentId)}"]`,
            );
            return element
              ? { width: element.offsetWidth, height: element.offsetHeight }
              : PIECE_SIZE;
          })()
          : PIECE_SIZE,
      );
      if (payload.source === "tray") {
        void addFragmentToTopic(payload.fragmentId, placement);
      } else {
        const fragment = state.currentTopic?.fragments
          .find(({ id }) => id === payload.fragmentId);
        const activePuzzle = puzzleDefinitionFor(state.currentTopic?.active_puzzle_id);
        const puzzlePiece = fragment && activePuzzle && fragment.position < activePuzzle.pieceCount
          ? activePuzzle.pieces[fragment.shape_variant]
          : null;
        const resolvedPlacement = puzzlePiece
          ? snapPuzzlePlacement(
            placement,
            puzzlePiece.bounds,
            activePuzzle.canvas,
            {
              width: refs.topicBoard.clientWidth,
              height: refs.topicBoard.clientHeight,
            },
          )
          : { ...placement, is_snapped: false };
        void moveFragmentInTopic(payload.fragmentId, resolvedPlacement);
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
    refs.openPuzzleShopButton.addEventListener("click", () => void openPuzzleShop());
    refs.autoArrangeTopicButton.addEventListener("click", () => void autoArrangeCurrentTopic());
    refs.deleteTopicButton.addEventListener("click", () => refs.deleteTopicDialog.showModal());
    refs.confirmDeleteTopic.addEventListener("click", () => void removeCurrentTopic());
    refs.pieceDetailRemove.addEventListener("click", () => {
      const fragmentId = detailFragmentId;
      refs.pieceDetailDialog.close();
      if (fragmentId) void removeFragmentFromTopic(fragmentId);
    });
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
