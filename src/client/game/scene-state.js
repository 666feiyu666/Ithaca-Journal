export const SCENE_STATE_STORAGE_KEY = "ithaca-journal.scene-state.v1";

function readStates(storage, storageKey) {
  try {
    const parsed = JSON.parse(storage?.getItem(storageKey) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStates(storage, storageKey, states) {
  try {
    storage?.setItem(storageKey, JSON.stringify(states));
  } catch {
    // 场景状态仍可在当前会话中使用；浏览器拒绝本地存储时只是不持久化。
  }
}

export function createSceneStateStore({ storage, storageKey = SCENE_STATE_STORAGE_KEY } = {}) {
  let states = readStates(storage, storageKey);

  function get(sceneId, stateKey, fallback = false) {
    const value = states[sceneId]?.[stateKey];
    return typeof value === "boolean" ? value : Boolean(fallback);
  }

  function set(sceneId, stateKey, value) {
    states = {
      ...states,
      [sceneId]: {
        ...states[sceneId],
        [stateKey]: Boolean(value),
      },
    };
    writeStates(storage, storageKey, states);
    return Boolean(value);
  }

  return Object.freeze({
    get,
    set,
    toggle(sceneId, stateKey, fallback = false) {
      return set(sceneId, stateKey, !get(sceneId, stateKey, fallback));
    },
  });
}
