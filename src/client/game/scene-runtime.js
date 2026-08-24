import { createSceneArrangement } from "./scene-arrangement.js";
import { clampSceneObjectPosition, createSceneLayoutStore } from "./scene-layout.js";
import { resolvePhaseValue } from "./scene-registry.js";
import { createSceneRenderer, positionSceneObject } from "./scene-renderer.js";
import { createSceneStateStore } from "./scene-state.js";

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
  const stateStore = createSceneStateStore({ storage: getBrowserStorage() });

  let currentSceneId = null;
  let mode = "explore";
  let timeSnapshot = timeService.getSnapshot();
  let activeHintObjectId = null;
  let renderer;

  const isMovable = (sceneObject) => sceneObject.movable === true;

  function getObjectState(sceneObject, sceneId = currentSceneId) {
    if (!sceneId || !sceneObject.toggleState) return false;
    return stateStore.get(
      sceneId,
      sceneObject.toggleState.key,
      sceneObject.toggleState.defaultValue,
    );
  }

  function getTogglePresentation(sceneObject) {
    if (!sceneObject.toggleState) return null;
    return sceneObject.toggleState[getObjectState(sceneObject) ? "on" : "off"];
  }

  function getObjectHintTitle(sceneObject) {
    return (
      getTogglePresentation(sceneObject)?.actionLabel ??
      sceneObject.hint?.title ??
      sceneObject.label
    );
  }

  function getObjectHintText(sceneObject) {
    const toggleText = getTogglePresentation(sceneObject)?.statusText;
    if (toggleText) return toggleText;
    return (
      resolvePhaseValue(sceneObject.hint?.textByPhase, timeSnapshot.phase) ??
      sceneObject.hint?.text ??
      ""
    );
  }

  function getObjectAccessibleLabel(sceneObject) {
    const togglePresentation = getTogglePresentation(sceneObject);
    if (togglePresentation) {
      return [togglePresentation.actionLabel, togglePresentation.statusText].join("：");
    }
    return [sceneObject.label, getObjectHintText(sceneObject)].filter(Boolean).join("：");
  }

  function getSceneObjectRect(sceneObject, sceneId = currentSceneId) {
    if (!sceneId || !isMovable(sceneObject)) return sceneObject.hitArea;
    const savedPosition = layoutStore.get(sceneId, sceneObject.id);
    if (!savedPosition) return sceneObject.hitArea;
    return {
      ...sceneObject.hitArea,
      ...clampSceneObjectPosition(sceneObject.hitArea, savedPosition),
    };
  }

  const getCurrentScene = () => (currentSceneId ? registry.get(currentSceneId) : null);

  function updateObjectAccessibility() {
    const scene = getCurrentScene();
    if (!scene) return;
    for (const sceneObject of scene.objects) {
      const button = objectsRoot.querySelector(`[data-scene-object-id="${sceneObject.id}"]`);
      if (!button) continue;
      const arrangingObject = mode === "arrange" && isMovable(sceneObject);
      const interactiveObject = sceneObject.interactive !== false;
      const exploringObject = mode === "explore" && interactiveObject;
      const availableObject = arrangingObject || exploringObject;
      button.tabIndex = availableObject ? 0 : -1;
      button.toggleAttribute("aria-hidden", !availableObject);
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
          : getObjectAccessibleLabel(sceneObject),
      );
    }
  }

  function hideHint() {
    activeHintObjectId = null;
    hint.hidden = true;
    hint.setAttribute("aria-hidden", "true");
  }

  function showHint(sceneObject) {
    if (mode !== "explore") return;
    activeHintObjectId = sceneObject.id;
    hintTitle.textContent = getObjectHintTitle(sceneObject);
    hintText.textContent = getObjectHintText(sceneObject);
    const baseAnchor = sceneObject.hintAnchor ?? {
      x: sceneObject.hitArea.x + sceneObject.hitArea.width / 2,
      y: sceneObject.hitArea.y,
    };
    const currentRect = getSceneObjectRect(sceneObject);
    const anchor = {
      x: baseAnchor.x + currentRect.x - sceneObject.hitArea.x,
      y: baseAnchor.y + currentRect.y - sceneObject.hitArea.y,
    };
    hint.style.setProperty("--hint-x", `${anchor.x}%`);
    hint.style.setProperty("--hint-y", `${anchor.y}%`);
    hint.hidden = false;
    hint.setAttribute("aria-hidden", "false");
  }

  const getObjectVisualSource = (sceneObject) => {
    const togglePresentation = getTogglePresentation(sceneObject);
    return resolvePhaseValue(
      togglePresentation?.visualSourceByPhase ??
        togglePresentation?.visualSource ??
        sceneObject.visualSourceByPhase ??
        sceneObject.visualSource,
      timeSnapshot.phase,
    );
  };

  const getSceneTitle = (scene) =>
    resolvePhaseValue(scene.titleByPhase, timeSnapshot.phase) ?? scene.title;

  function setMode(nextMode) {
    mode = nextMode;
    root.dataset.interactionMode = nextMode;
    objectsRoot.inert = !new Set(["explore", "arrange"]).has(nextMode);
    if (nextMode !== "explore") hideHint();
    updateObjectAccessibility();
    arrangement.updateControls();
  }

  function executeAction(action, returnFocus) {
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
  }

  function activateObject(sceneObject, button) {
    if (mode !== "explore") return;
    hideHint();
    if (sceneObject.toggleState) {
      stateStore.toggle(
        currentSceneId,
        sceneObject.toggleState.key,
        sceneObject.toggleState.defaultValue,
      );
      const scene = getCurrentScene();
      applySceneState(scene);
      renderer.updateObjectStates(scene);
      showHint(sceneObject);
      return;
    }
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
  }

  function openDialogue(
    dialogueId,
    { onConfirm, onDismiss, onError: dialogueError = onError, returnFocus } = {},
  ) {
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
  }

  const positionObject = (button, sceneObject, position, { persist = false } = {}) =>
    positionSceneObject(button, sceneObject, position, {
      currentSceneId,
      layoutStore,
      persist,
      clampPosition: clampSceneObjectPosition,
    });

  const arrangement = createSceneArrangement({
    root,
    world,
    objectsRoot,
    arrangeToggle,
    arrangeReset,
    arrangeStatus,
    layoutStore,
    isMovable,
    getMode: () => mode,
    setMode,
    getCurrentScene,
    getSceneObjectRect,
    positionObject,
    renderObjects: (scene) => renderer.renderObjects(scene),
  });

  renderer = createSceneRenderer({
    layersRoot,
    objectsRoot,
    getTimeSnapshot: () => timeSnapshot,
    resolvePhaseValue,
    getObjectAccessibleLabel,
    getObjectState,
    getSceneObjectRect,
    getObjectVisualSource,
    isMovable,
    showHint,
    hideHint,
    getActiveHintObjectId: () => activeHintObjectId,
    activateObject,
    arrangement,
    updateObjectAccessibility,
  });

  function applySceneState(scene) {
    const lightIsOn = scene.objects.some(
      (sceneObject) =>
        sceneObject.toggleState?.key === "light" && getObjectState(sceneObject, scene.id),
    );
    root.dataset.sceneLight = lightIsOn ? "on" : "off";
  }

  function show(sceneId, { focus = true } = {}) {
    const scene = registry.get(sceneId);
    dialogueRuntime.close();
    window.scrollTo({ top: 0, left: 0 });
    currentSceneId = sceneId;
    root.dataset.sceneId = sceneId;
    applySceneState(scene);
    world.style.setProperty("--scene-aspect", String(scene.aspectRatio ?? 16 / 9));
    eyebrow.textContent = scene.eyebrow ?? scene.title;
    heading.textContent = getSceneTitle(scene);
    description.textContent = scene.description ?? "";
    renderer.renderLayers(scene);
    renderer.renderObjects(scene);
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
      renderer.renderLayers(scene);
      renderer.updatePhaseObjects(scene);
      if (activeHintObjectId) {
        const sceneObject = scene.objects.find(
          (candidate) => candidate.id === activeHintObjectId,
        );
        if (sceneObject) showHint(sceneObject);
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

  arrangement.bindEvents();

  return Object.freeze({
    show,
    openDialogue,
    setArrangeMode: arrangement.setArrangeMode,
    resetArrangement: arrangement.reset,
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
