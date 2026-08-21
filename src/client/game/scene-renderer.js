function applyRect(element, rect) {
  element.style.left = `${rect.x}%`;
  element.style.top = `${rect.y}%`;
  element.style.width = `${rect.width}%`;
  element.style.height = `${rect.height}%`;
}

export function createSceneRenderer({
  layersRoot,
  objectsRoot,
  getTimeSnapshot,
  resolvePhaseValue,
  getObjectHintText,
  getSceneObjectRect,
  getObjectVisualSource,
  isMovable,
  showHint,
  hideHint,
  getActiveHintObjectId,
  activateObject,
  arrangement,
  updateObjectAccessibility,
}) {
  function renderLayers(scene) {
    layersRoot.replaceChildren();
    for (const layer of scene.layers) {
      let element;
      if (layer.type === "image") {
        const source = resolvePhaseValue(
          layer.sourceByPhase ?? layer.source,
          getTimeSnapshot().phase,
        );
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
  }

  function renderObjects(scene) {
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
        visual.addEventListener("error", () =>
          button.classList.add("scene-object--visual-failed"),
        );
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
        if (
          document.activeElement !== button &&
          getActiveHintObjectId() === sceneObject.id
        ) {
          hideHint();
        }
      });
      button.addEventListener("pointerdown", (event) =>
        arrangement.beginDrag(event, sceneObject, button),
      );
      button.addEventListener("pointermove", arrangement.moveDrag);
      button.addEventListener("pointerup", arrangement.finishDrag);
      button.addEventListener("pointercancel", (event) =>
        arrangement.finishDrag(event, { cancelled: true }),
      );
      button.addEventListener("keydown", (event) =>
        arrangement.moveWithKeyboard(event, sceneObject, button),
      );
      button.addEventListener("click", () => activateObject(sceneObject, button));
      objectsRoot.append(button);
    }
  }

  function updatePhaseObjects(scene) {
    for (const sceneObject of scene.objects) {
      const button = objectsRoot.querySelector(`[data-scene-object-id="${sceneObject.id}"]`);
      if (!button) continue;
      const visual = button.querySelector("[data-scene-object-visual]");
      const source = getObjectVisualSource(sceneObject);
      if (visual && source && visual.getAttribute("src") !== source) {
        visual.setAttribute("src", source);
      }
    }
    updateObjectAccessibility();
  }

  return Object.freeze({ renderLayers, renderObjects, updatePhaseObjects });
}

export function positionSceneObject(
  button,
  sceneObject,
  position,
  { currentSceneId, layoutStore, persist = false, clampPosition } = {},
) {
  const clamped = clampPosition(sceneObject.hitArea, position);
  applyRect(button, { ...sceneObject.hitArea, ...clamped });
  button.dataset.sceneObjectX = String(clamped.x);
  button.dataset.sceneObjectY = String(clamped.y);
  if (persist && currentSceneId) {
    layoutStore.set(currentSceneId, sceneObject.id, clamped);
  }
  return clamped;
}
