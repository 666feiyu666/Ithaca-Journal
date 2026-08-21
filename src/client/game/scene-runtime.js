import { resolvePhaseValue } from "./scene-registry.js";
import { clampSceneObjectPosition, createSceneLayoutStore } from "./scene-layout.js";

function applyRect(element, rect) {
  element.style.left = `${rect.x}%`;
  element.style.top = `${rect.y}%`;
  element.style.width = `${rect.width}%`;
  element.style.height = `${rect.height}%`;
}

function getBrowserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createSceneRuntime({
  root,
  registry,
  dialogues,
  dialogueRuntime,
  timeService,
  actions,
  onError = (error) => console.error(error),
}) {
  if (!(root instanceof HTMLElement)) {
    throw new TypeError("场景运行时需要有效的根元素。");
  }
  const world = root.querySelector("[data-scene-world]");
  const layersRoot = root.querySelector("[data-scene-layers]");
  const objectsRoot = root.querySelector("[data-scene-objects]");
  const eyebrow = root.querySelector("[data-scene-eyebrow]");
  const heading = root.querySelector("[data-scene-heading]");
  const description = root.querySelector("[data-scene-description]");
  const hint = root.querySelector("[data-scene-hint]");
  const hintTitle = hint.querySelector("[data-scene-hint-title]");
  const hintText = hint.querySelector("[data-scene-hint-text]");
  const arrangeToggle = root.querySelector("[data-scene-arrange-toggle]");
  const arrangeReset = root.querySelector("[data-scene-arrange-reset]");
  const arrangeStatus = root.querySelector("[data-scene-arrange-status]");
  const layoutStore = createSceneLayoutStore({ storage: getBrowserStorage() });

  let currentSceneId = null;
  let mode = "explore";
  let timeSnapshot = timeService.getSnapshot();
  let activeHintObjectId = null;
  let dragState = null;

  function getObjectHintText(sceneObject) {
    return (
      resolvePhaseValue(sceneObject.hint?.textByPhase, timeSnapshot.phase) ??
      sceneObject.hint?.text ??
      ""
    );
  }

  const isMovable = (sceneObject) => sceneObject.movable === true;

  const getSceneObjectRect = (sceneObject, sceneId = currentSceneId) => {
    if (!sceneId || !isMovable(sceneObject)) return sceneObject.hitArea;
    const savedPosition = layoutStore.get(sceneId, sceneObject.id);
    if (!savedPosition) return sceneObject.hitArea;
    return {
      ...sceneObject.hitArea,
      ...clampSceneObjectPosition(sceneObject.hitArea, savedPosition),
    };
  };

  const getCurrentScene = () => (currentSceneId ? registry.get(currentSceneId) : null);

  const updateObjectAccessibility = () => {
    const scene = getCurrentScene();
    if (!scene) return;
    for (const sceneObject of scene.objects) {
      const button = objectsRoot.querySelector(`[data-scene-object-id="${sceneObject.id}"]`);
      if (!button) continue;
      const arrangingObject = mode === "arrange" && isMovable(sceneObject);
      button.tabIndex = mode === "arrange" && !arrangingObject ? -1 : 0;
      button.toggleAttribute("aria-keyshortcuts", arrangingObject);
      if (arrangingObject) {
        button.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown ArrowLeft ArrowRight");
        button.setAttribute("aria-describedby", "scene-arrange-status");
      } else {
        button.removeAttribute("aria-describedby");
      }
      button.setAttribute(
        "aria-label",
        arrangingObject
          ? `${sceneObject.label}：可拖动，也可使用方向键调整位置`
          : [sceneObject.label, getObjectHintText(sceneObject)].filter(Boolean).join("："),
      );
    }
  };

  const updateArrangementControls = () => {
    const scene = getCurrentScene();
    const canArrange = Boolean(scene?.objects.some(isMovable));
    const arranging = canArrange && mode === "arrange";
    arrangeToggle.hidden = !canArrange;
    arrangeToggle.textContent = arranging ? "完成布置" : "布置房间";
    arrangeToggle.setAttribute("aria-pressed", String(arranging));
    arrangeReset.hidden = !arranging;
    arrangeStatus.hidden = !arranging;
  };

  const setMode = (nextMode) => {
    mode = nextMode;
    root.dataset.interactionMode = nextMode;
    objectsRoot.inert = !new Set(["explore", "arrange"]).has(nextMode);
    if (nextMode !== "explore") hideHint();
    updateObjectAccessibility();
    updateArrangementControls();
  };

  function hideHint() {
    activeHintObjectId = null;
    hint.hidden = true;
    hint.setAttribute("aria-hidden", "true");
  }

  const showHint = (object) => {
    if (mode !== "explore") return;
    activeHintObjectId = object.id;
    hintTitle.textContent = object.hint?.title ?? object.label;
    hintText.textContent = resolvePhaseValue(object.hint?.textByPhase, timeSnapshot.phase) ?? object.hint?.text ?? "";
    const baseAnchor = object.hintAnchor ?? {
      x: object.hitArea.x + object.hitArea.width / 2,
      y: object.hitArea.y,
    };
    const currentRect = getSceneObjectRect(object);
    const anchor = {
      x: baseAnchor.x + currentRect.x - object.hitArea.x,
      y: baseAnchor.y + currentRect.y - object.hitArea.y,
    };
    hint.style.setProperty("--hint-x", `${anchor.x}%`);
    hint.style.setProperty("--hint-y", `${anchor.y}%`);
    hint.hidden = false;
    hint.setAttribute("aria-hidden", "false");
  };

  const renderLayers = (scene) => {
    layersRoot.replaceChildren();
    for (const layer of scene.layers) {
      let element;
      if (layer.type === "image") {
        const source = resolvePhaseValue(layer.sourceByPhase ?? layer.source, timeSnapshot.phase);
        if (!source) continue;
        element = document.createElement("img");
        element.src = source;
        element.alt = layer.alt ?? "";
        element.draggable = false;
        element.style.objectFit = layer.fit ?? "cover";
        element.addEventListener("error", () => element.classList.add("scene-layer--failed"));
      } else {
        element = document.createElement("div");
        element.classList.add("scene-layer--placeholder");
        const title = document.createElement("strong");
        title.textContent = layer.label ?? scene.title;
        const copy = document.createElement("span");
        copy.textContent = layer.description ?? "正式场景素材准备中";
        element.append(title, copy);
      }
      element.classList.add("scene-layer");
      element.dataset.sceneLayerId = layer.id;
      element.style.zIndex = String(layer.z ?? 0);
      layersRoot.append(element);
    }
  };

  const getObjectVisualSource = (sceneObject) =>
    resolvePhaseValue(
      sceneObject.visualSourceByPhase ?? sceneObject.visualSource,
      timeSnapshot.phase,
    );

  const getSceneTitle = (scene) =>
    resolvePhaseValue(scene.titleByPhase, timeSnapshot.phase) ?? scene.title;

  const executeAction = (action, returnFocus) => {
    if (!action || action.type === "close") {
      setMode("explore");
      returnFocus?.focus({ preventScroll: true });
      return;
    }
    if (action.type === "scene") {
      setMode("transition");
      window.requestAnimationFrame(() => show(action.target));
      return;
    }
    if (action.type === "feature") {
      const handler = actions[action.target];
      if (typeof handler !== "function") throw new Error(`未注册场景动作：${action.target}`);
      setMode("busy");
      Promise.resolve()
        .then(() => handler())
        .catch((error) => onError(error))
        .finally(() => {
          if (!root.hidden && mode === "busy") setMode("explore");
        });
      return;
    }
    throw new Error(`未知场景动作类型：${action.type}`);
  };

  const activateObject = (sceneObject, button) => {
    if (mode !== "explore") return;
    hideHint();
    const dialogue = dialogues[sceneObject.dialogueId];
    if (!dialogue) {
      executeAction(sceneObject.action, button);
      return;
    }
    setMode("dialogue");
    dialogueRuntime.open(dialogue, {
      phase: timeSnapshot.phase,
      returnFocus: button,
      onDismiss: () => setMode("explore"),
      onConfirm: () => executeAction(sceneObject.action, button),
    });
  };

  const openDialogue = (
    dialogueId,
    { onConfirm, onDismiss, onError: dialogueError = onError, returnFocus } = {},
  ) => {
    const dialogue = dialogues[dialogueId];
    if (!dialogue) throw new Error(`未注册场景对话：${dialogueId}`);
    setMode("dialogue");
    dialogueRuntime.open(dialogue, {
      phase: timeSnapshot.phase,
      returnFocus,
      onDismiss: () => {
        setMode("explore");
        onDismiss?.();
      },
      onConfirm: async () => {
        setMode("busy");
        try {
          await onConfirm?.();
          if (!root.hidden && mode === "busy") setMode("explore");
        } catch (error) {
          if (!root.hidden && mode === "busy") setMode("dialogue");
          throw error;
        }
      },
      onError: dialogueError,
    });
  };

  const setArrangeStatus = (message) => {
    arrangeStatus.textContent = message;
  };

  const positionSceneObject = (button, sceneObject, position, { persist = false } = {}) => {
    const clamped = clampSceneObjectPosition(sceneObject.hitArea, position);
    applyRect(button, { ...sceneObject.hitArea, ...clamped });
    button.dataset.sceneObjectX = String(clamped.x);
    button.dataset.sceneObjectY = String(clamped.y);
    if (persist && currentSceneId) {
      layoutStore.set(currentSceneId, sceneObject.id, clamped);
    }
    return clamped;
  };

  const beginObjectDrag = (event, sceneObject, button) => {
    if (mode !== "arrange" || !isMovable(sceneObject) || event.button !== 0) return;
    event.preventDefault();
    const currentRect = getSceneObjectRect(sceneObject);
    dragState = {
      button,
      sceneObject,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: { x: currentRect.x, y: currentRect.y },
      currentPosition: { x: currentRect.x, y: currentRect.y },
      moved: false,
    };
    button.setPointerCapture(event.pointerId);
    button.classList.add("scene-object--dragging");
    button.focus({ preventScroll: true });
    setArrangeStatus(`正在移动${sceneObject.label}。松开即可保存位置。`);
  };

  const moveObjectDrag = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    event.preventDefault();
    const worldRect = world.getBoundingClientRect();
    if (!worldRect.width || !worldRect.height) return;
    const nextPosition = {
      x:
        dragState.startPosition.x +
        ((event.clientX - dragState.startClientX) / worldRect.width) * 100,
      y:
        dragState.startPosition.y +
        ((event.clientY - dragState.startClientY) / worldRect.height) * 100,
    };
    dragState.currentPosition = positionSceneObject(
      dragState.button,
      dragState.sceneObject,
      nextPosition,
    );
    dragState.moved = true;
  };

  const finishObjectDrag = (event, { cancelled = false } = {}) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const completedDrag = dragState;
    dragState = null;
    completedDrag.button.classList.remove("scene-object--dragging");
    if (completedDrag.button.hasPointerCapture(event.pointerId)) {
      completedDrag.button.releasePointerCapture(event.pointerId);
    }
    if (cancelled) {
      positionSceneObject(
        completedDrag.button,
        completedDrag.sceneObject,
        completedDrag.startPosition,
      );
      setArrangeStatus(`已取消移动${completedDrag.sceneObject.label}。`);
      return;
    }
    positionSceneObject(
      completedDrag.button,
      completedDrag.sceneObject,
      completedDrag.currentPosition,
      { persist: true },
    );
    setArrangeStatus(
      completedDrag.moved
        ? `${completedDrag.sceneObject.label}的位置已保存在当前设备。`
        : `${completedDrag.sceneObject.label}已选中，可使用方向键微调。`,
    );
  };

  const moveObjectWithKeyboard = (event, sceneObject, button) => {
    if (mode !== "arrange" || !isMovable(sceneObject)) return;
    const deltaByKey = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
    };
    const delta = deltaByKey[event.key];
    if (!delta) return;
    event.preventDefault();
    const step = event.shiftKey ? 2 : 0.5;
    const currentRect = getSceneObjectRect(sceneObject);
    positionSceneObject(
      button,
      sceneObject,
      {
        x: currentRect.x + delta.x * step,
        y: currentRect.y + delta.y * step,
      },
      { persist: true },
    );
    setArrangeStatus(`${sceneObject.label}的位置已保存。按住 Shift 可更快移动。`);
  };

  const setArrangeMode = (enabled, { restoreFocus = true } = {}) => {
    const scene = getCurrentScene();
    if (!scene?.objects.some(isMovable)) return;
    dragState = null;
    setMode(enabled ? "arrange" : "explore");
    if (enabled) {
      setArrangeStatus("拖动物件调整位置；也可以聚焦物件后使用方向键微调，按 Esc 完成。");
      const firstMovable = scene.objects.find(isMovable);
      window.requestAnimationFrame(() => {
        objectsRoot
          .querySelector(`[data-scene-object-id="${firstMovable.id}"]`)
          ?.focus({ preventScroll: true });
      });
    } else if (restoreFocus) {
      window.requestAnimationFrame(() => arrangeToggle.focus({ preventScroll: true }));
    }
  };

  const resetArrangement = () => {
    const scene = getCurrentScene();
    if (!scene || mode !== "arrange") return;
    layoutStore.reset(scene.id);
    renderObjects(scene);
    setMode("arrange");
    setArrangeStatus("已恢复房间的默认布置。拖动物件可以重新调整。");
    const firstMovable = scene.objects.find(isMovable);
    window.requestAnimationFrame(() => {
      objectsRoot
        .querySelector(`[data-scene-object-id="${firstMovable.id}"]`)
        ?.focus({ preventScroll: true });
    });
  };

  const renderObjects = (scene) => {
    objectsRoot.replaceChildren();
    for (const sceneObject of scene.objects) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scene-object";
      button.dataset.sceneObjectId = sceneObject.id;
      button.dataset.sceneObjectKind = sceneObject.kind ?? "ambient";
      button.dataset.sceneObjectLabel = sceneObject.label;
      button.dataset.sceneObjectMovable = String(isMovable(sceneObject));
      button.setAttribute(
        "aria-label",
        [sceneObject.label, getObjectHintText(sceneObject)].filter(Boolean).join("："),
      );
      const resolvedRect = getSceneObjectRect(sceneObject, scene.id);
      applyRect(button, resolvedRect);
      button.dataset.sceneObjectX = String(resolvedRect.x);
      button.dataset.sceneObjectY = String(resolvedRect.y);

      const visualSource = getObjectVisualSource(sceneObject);
      if (visualSource) {
        const visual = document.createElement("img");
        visual.className = "scene-object__visual";
        visual.dataset.sceneObjectVisual = "true";
        visual.src = visualSource;
        visual.alt = "";
        visual.draggable = false;
        visual.style.objectFit = sceneObject.visualFit ?? "contain";
        visual.addEventListener("error", () => button.classList.add("scene-object--visual-failed"));
        button.append(visual);
      }

      if (sceneObject.placeholderVisual) {
        const marker = document.createElement("span");
        marker.className = "scene-object__marker";
        marker.setAttribute("aria-hidden", "true");
        marker.textContent = sceneObject.label;
        button.classList.add("scene-object--placeholder");
        button.append(marker);
      }

      button.addEventListener("pointerenter", () => showHint(sceneObject));
      button.addEventListener("pointerleave", () => {
        if (document.activeElement !== button && activeHintObjectId === sceneObject.id) {
          hideHint();
        }
      });
      button.addEventListener("pointerdown", (event) => beginObjectDrag(event, sceneObject, button));
      button.addEventListener("pointermove", moveObjectDrag);
      button.addEventListener("pointerup", (event) => finishObjectDrag(event));
      button.addEventListener("pointercancel", (event) =>
        finishObjectDrag(event, { cancelled: true }),
      );
      button.addEventListener("keydown", (event) =>
        moveObjectWithKeyboard(event, sceneObject, button),
      );
      button.addEventListener("click", () => activateObject(sceneObject, button));
      objectsRoot.append(button);
    }
  };

  const updatePhaseObjects = (scene) => {
    for (const sceneObject of scene.objects) {
      const button = objectsRoot.querySelector(`[data-scene-object-id="${sceneObject.id}"]`);
      if (!button) continue;
      const visual = button.querySelector("[data-scene-object-visual]");
      const source = getObjectVisualSource(sceneObject);
      if (visual && source && visual.getAttribute("src") !== source) visual.setAttribute("src", source);
    }
    updateObjectAccessibility();
  };

  function show(sceneId, { focus = true } = {}) {
    const scene = registry.get(sceneId);
    dialogueRuntime.close();
    window.scrollTo({ top: 0, left: 0 });
    currentSceneId = sceneId;
    root.dataset.sceneId = sceneId;
    world.style.setProperty("--scene-aspect", String(scene.aspectRatio ?? 16 / 9));
    eyebrow.textContent = scene.eyebrow ?? scene.title;
    heading.textContent = getSceneTitle(scene);
    description.textContent = scene.description ?? "";
    renderLayers(scene);
    renderObjects(scene);
    setMode("explore");
    hideHint();
    if (focus) {
      const focusId = scene.initialFocusObjectId ?? scene.objects[0]?.id;
      const target = objectsRoot.querySelector(`[data-scene-object-id="${focusId}"]`);
      const focusObject = scene.objects.find((candidate) => candidate.id === focusId);
      window.requestAnimationFrame(() => {
        target?.focus({ preventScroll: true });
        if (target && document.activeElement === target && focusObject) showHint(focusObject);
      });
    }
  }

  timeService.subscribe((snapshot) => {
    const phaseChanged = timeSnapshot.phase !== snapshot.phase;
    timeSnapshot = snapshot;
    root.dataset.timePhase = snapshot.phase;
    root.dataset.timeMode = snapshot.timeMode;
    if (phaseChanged && currentSceneId) {
      const scene = registry.get(currentSceneId);
      heading.textContent = getSceneTitle(scene);
      renderLayers(scene);
      updatePhaseObjects(scene);
      if (activeHintObjectId) {
        const object = scene.objects.find((candidate) => candidate.id === activeHintObjectId);
        if (object) showHint(object);
      }
    }
  });

  objectsRoot.addEventListener("focusin", (event) => {
    const button = event.target.closest?.("[data-scene-object-id]");
    if (!button || !currentSceneId) return;
    const scene = registry.get(currentSceneId);
    const sceneObject = scene.objects.find(
      (candidate) => candidate.id === button.dataset.sceneObjectId,
    );
    if (sceneObject) showHint(sceneObject);
  });

  objectsRoot.addEventListener("focusout", (event) => {
    if (event.relatedTarget?.closest?.("[data-scene-object-id]")) return;
    hideHint();
  });

  arrangeToggle.addEventListener("click", () => setArrangeMode(mode !== "arrange"));
  arrangeReset.addEventListener("click", resetArrangement);
  root.addEventListener("keydown", (event) => {
    if (mode !== "arrange" || event.key !== "Escape") return;
    event.preventDefault();
    setArrangeMode(false);
  });

  return Object.freeze({
    show,
    openDialogue,
    setArrangeMode,
    resetArrangement,
    getCurrentSceneId() {
      return currentSceneId;
    },
    getMode() {
      return mode;
    },
    focusObject(objectId) {
      const target = objectsRoot.querySelector(`[data-scene-object-id="${objectId}"]`);
      target?.focus({ preventScroll: true });
      if (!currentSceneId || document.activeElement !== target) return;
      const sceneObject = registry
        .get(currentSceneId)
        .objects.find((candidate) => candidate.id === objectId);
      if (sceneObject) showHint(sceneObject);
    },
  });
}
