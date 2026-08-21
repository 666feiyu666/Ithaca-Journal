import { resolvePhaseValue } from "./scene-registry.js";

function applyRect(element, rect) {
  element.style.left = `${rect.x}%`;
  element.style.top = `${rect.y}%`;
  element.style.width = `${rect.width}%`;
  element.style.height = `${rect.height}%`;
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
  const frame = root.querySelector("[data-scene-frame]");
  const layersRoot = root.querySelector("[data-scene-layers]");
  const objectsRoot = root.querySelector("[data-scene-objects]");
  const eyebrow = root.querySelector("[data-scene-eyebrow]");
  const heading = root.querySelector("[data-scene-heading]");
  const description = root.querySelector("[data-scene-description]");
  const hint = root.querySelector("[data-scene-hint]");
  const hintTitle = hint.querySelector("[data-scene-hint-title]");
  const hintText = hint.querySelector("[data-scene-hint-text]");

  let currentSceneId = null;
  let mode = "explore";
  let timeSnapshot = timeService.getSnapshot();
  let activeHintObjectId = null;

  const setMode = (nextMode) => {
    mode = nextMode;
    root.dataset.interactionMode = nextMode;
    objectsRoot.inert = nextMode !== "explore";
    if (nextMode !== "explore") hideHint();
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
    const anchor = object.hintAnchor ?? {
      x: object.hitArea.x + object.hitArea.width / 2,
      y: object.hitArea.y,
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

  const getObjectHintText = (sceneObject) =>
    resolvePhaseValue(sceneObject.hint?.textByPhase, timeSnapshot.phase) ??
    sceneObject.hint?.text ??
    "";

  const getObjectVisualSource = (sceneObject) =>
    resolvePhaseValue(
      sceneObject.visualSourceByPhase ?? sceneObject.visualSource,
      timeSnapshot.phase,
    );

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

  const renderObjects = (scene) => {
    objectsRoot.replaceChildren();
    for (const sceneObject of scene.objects) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scene-object";
      button.dataset.sceneObjectId = sceneObject.id;
      button.dataset.sceneObjectKind = sceneObject.kind ?? "ambient";
      button.setAttribute(
        "aria-label",
        [sceneObject.label, getObjectHintText(sceneObject)].filter(Boolean).join("："),
      );
      applyRect(button, sceneObject.hitArea);

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
      button.addEventListener("click", () => activateObject(sceneObject, button));
      objectsRoot.append(button);
    }
  };

  const updatePhaseObjects = (scene) => {
    for (const sceneObject of scene.objects) {
      const button = objectsRoot.querySelector(`[data-scene-object-id="${sceneObject.id}"]`);
      if (!button) continue;
      button.setAttribute(
        "aria-label",
        [sceneObject.label, getObjectHintText(sceneObject)].filter(Boolean).join("："),
      );
      const visual = button.querySelector("[data-scene-object-visual]");
      const source = getObjectVisualSource(sceneObject);
      if (visual && source && visual.getAttribute("src") !== source) visual.setAttribute("src", source);
    }
  };

  function show(sceneId, { focus = true } = {}) {
    const scene = registry.get(sceneId);
    dialogueRuntime.close();
    window.scrollTo({ top: 0, left: 0 });
    currentSceneId = sceneId;
    root.dataset.sceneId = sceneId;
    frame.style.aspectRatio = String(scene.aspectRatio ?? 16 / 9);
    eyebrow.textContent = scene.eyebrow ?? scene.title;
    heading.textContent = scene.title;
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
    if (phaseChanged && currentSceneId) {
      const scene = registry.get(currentSceneId);
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

  return Object.freeze({
    show,
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
