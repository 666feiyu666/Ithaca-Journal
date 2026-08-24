export const SCENE_LAYOUT_STORAGE_KEY = "ithaca-journal.scene-layout.v2";

function isFiniteCoordinate(value) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

export function clampSceneObjectPosition(rect, position) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  return {
    x: Math.min(Math.max(Number.isFinite(x) ? x : rect.x, 0), 100 - rect.width),
    y: Math.min(Math.max(Number.isFinite(y) ? y : rect.y, 0), 100 - rect.height),
  };
}

function readLayouts(storage, storageKey) {
  try {
    const parsed = JSON.parse(storage?.getItem(storageKey) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLayouts(storage, storageKey, layouts) {
  try {
    storage?.setItem(storageKey, JSON.stringify(layouts));
  } catch {
    // 布置仍可在当前会话中使用；浏览器拒绝本地存储时只是不持久化。
  }
}

export function createSceneLayoutStore({ storage, storageKey = SCENE_LAYOUT_STORAGE_KEY } = {}) {
  let layouts = readLayouts(storage, storageKey);

  return Object.freeze({
    get(sceneId, objectId) {
      const position = layouts[sceneId]?.[objectId];
      if (!isFiniteCoordinate(position?.x) || !isFiniteCoordinate(position?.y)) return null;
      return { x: position.x, y: position.y };
    },

    set(sceneId, objectId, position) {
      if (!isFiniteCoordinate(position?.x) || !isFiniteCoordinate(position?.y)) return;
      layouts = {
        ...layouts,
        [sceneId]: {
          ...layouts[sceneId],
          [objectId]: { x: position.x, y: position.y },
        },
      };
      writeLayouts(storage, storageKey, layouts);
    },

    reset(sceneId) {
      const { [sceneId]: _removed, ...remaining } = layouts;
      layouts = remaining;
      writeLayouts(storage, storageKey, layouts);
    },
  });
}
