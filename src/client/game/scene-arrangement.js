export function createSceneArrangement({
  root,
  world,
  objectsRoot,
  arrangeToggle,
  arrangeReset,
  arrangeStatus,
  layoutStore,
  isMovable,
  getMode,
  setMode,
  getCurrentScene,
  getSceneObjectRect,
  positionObject,
  renderObjects,
}) {
  let dragState = null;

  function setStatus(message) {
    arrangeStatus.textContent = message;
  }

  function updateControls() {
    const scene = getCurrentScene();
    const canArrange = Boolean(scene?.objects.some(isMovable));
    const arranging = canArrange && getMode() === "arrange";
    arrangeToggle.hidden = !canArrange;
    arrangeToggle.textContent = arranging ? "完成布置" : "布置房间";
    arrangeToggle.setAttribute("aria-pressed", String(arranging));
    arrangeReset.hidden = !arranging;
    arrangeStatus.hidden = !arranging;
  }

  function beginDrag(event, sceneObject, button) {
    if (getMode() !== "arrange" || !isMovable(sceneObject) || event.button !== 0) return;
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
    setStatus(`正在移动${sceneObject.label}。松开即可保存位置。`);
  }

  function moveDrag(event) {
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
    dragState.currentPosition = positionObject(
      dragState.button,
      dragState.sceneObject,
      nextPosition,
    );
    dragState.moved = true;
  }

  function finishDrag(event, { cancelled = false } = {}) {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const completedDrag = dragState;
    dragState = null;
    completedDrag.button.classList.remove("scene-object--dragging");
    if (completedDrag.button.hasPointerCapture(event.pointerId)) {
      completedDrag.button.releasePointerCapture(event.pointerId);
    }
    if (cancelled) {
      positionObject(
        completedDrag.button,
        completedDrag.sceneObject,
        completedDrag.startPosition,
      );
      setStatus(`已取消移动${completedDrag.sceneObject.label}。`);
      return;
    }
    positionObject(
      completedDrag.button,
      completedDrag.sceneObject,
      completedDrag.currentPosition,
      { persist: true },
    );
    setStatus(
      completedDrag.moved
        ? `${completedDrag.sceneObject.label}的位置已保存在当前设备。`
        : `${completedDrag.sceneObject.label}已选中，可使用方向键微调。`,
    );
  }

  function moveWithKeyboard(event, sceneObject, button) {
    if (getMode() !== "arrange" || !isMovable(sceneObject)) return;
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
    positionObject(
      button,
      sceneObject,
      {
        x: currentRect.x + delta.x * step,
        y: currentRect.y + delta.y * step,
      },
      { persist: true },
    );
    setStatus(`${sceneObject.label}的位置已保存。按住 Shift 可更快移动。`);
  }

  function setArrangeMode(enabled, { restoreFocus = true } = {}) {
    const scene = getCurrentScene();
    if (!scene?.objects.some(isMovable)) return;
    dragState = null;
    setMode(enabled ? "arrange" : "explore");
    if (enabled) {
      setStatus("拖动物件调整位置；也可以聚焦物件后使用方向键微调，按 Esc 完成。");
      const firstMovable = scene.objects.find(isMovable);
      window.requestAnimationFrame(() => {
        objectsRoot
          .querySelector(`[data-scene-object-id="${firstMovable.id}"]`)
          ?.focus({ preventScroll: true });
      });
    } else if (restoreFocus) {
      window.requestAnimationFrame(() => arrangeToggle.focus({ preventScroll: true }));
    }
  }

  function reset() {
    const scene = getCurrentScene();
    if (!scene || getMode() !== "arrange") return;
    layoutStore.reset(scene.id);
    renderObjects(scene);
    setMode("arrange");
    setStatus("已恢复房间的默认布置。拖动物件可以重新调整。");
    const firstMovable = scene.objects.find(isMovable);
    window.requestAnimationFrame(() => {
      objectsRoot
        .querySelector(`[data-scene-object-id="${firstMovable.id}"]`)
        ?.focus({ preventScroll: true });
    });
  }

  function bindEvents() {
    arrangeToggle.addEventListener("click", () => setArrangeMode(getMode() !== "arrange"));
    arrangeReset.addEventListener("click", reset);
    root.addEventListener("keydown", (event) => {
      if (getMode() !== "arrange" || event.key !== "Escape") return;
      event.preventDefault();
      setArrangeMode(false);
    });
  }

  return Object.freeze({
    beginDrag,
    bindEvents,
    finishDrag,
    moveDrag,
    moveWithKeyboard,
    reset,
    setArrangeMode,
    updateControls,
  });
}
