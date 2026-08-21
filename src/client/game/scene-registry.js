function assertText(value, path) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${path} 必须是非空字符串。`);
  }
}

function assertRect(rect, path) {
  if (!rect || typeof rect !== "object") {
    throw new TypeError(`${path} 必须提供归一化坐标。`);
  }
  for (const key of ["x", "y", "width", "height"]) {
    const value = rect[key];
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new TypeError(`${path}.${key} 必须是 0–100 之间的数字。`);
    }
  }
  if (rect.x + rect.width > 100 || rect.y + rect.height > 100) {
    throw new TypeError(`${path} 超出了场景画布。`);
  }
}

function assertPhaseSource(value, path) {
  if (typeof value === "string" && value.trim()) return;
  if (!value || typeof value !== "object") {
    throw new TypeError(`${path} 必须是素材路径或分时段素材表。`);
  }
  const sources = Object.values(value);
  if (!sources.length || sources.some((source) => typeof source !== "string" || !source.trim())) {
    throw new TypeError(`${path} 中的素材路径必须是非空字符串。`);
  }
}

function assertPhaseText(value, path) {
  if (!value || typeof value !== "object") {
    throw new TypeError(`${path} 必须是分时段文案表。`);
  }
  const values = Object.values(value);
  if (!values.length || values.some((text) => typeof text !== "string" || !text.trim())) {
    throw new TypeError(`${path} 中的文案必须是非空字符串。`);
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.isFrozen(value) ? value : Object.freeze(value);
}

function validateScene(scene) {
  assertText(scene?.id, "scene.id");
  assertText(scene?.title, `${scene.id}.title`);
  if (scene.titleByPhase) assertPhaseText(scene.titleByPhase, `${scene.id}.titleByPhase`);
  if (!Array.isArray(scene.layers) || !Array.isArray(scene.objects)) {
    throw new TypeError(`${scene.id} 必须提供 layers 和 objects 数组。`);
  }

  const layerIds = new Set();
  for (const layer of scene.layers) {
    assertText(layer?.id, `${scene.id}.layers[].id`);
    if (!new Set(["image", "placeholder"]).has(layer.type)) {
      throw new TypeError(`${scene.id}.${layer.id}.type 不是支持的图层类型。`);
    }
    if (layer.type === "image") {
      assertPhaseSource(layer.sourceByPhase ?? layer.source, `${scene.id}.${layer.id}.source`);
    }
    if (layerIds.has(layer.id)) {
      throw new TypeError(`${scene.id} 中存在重复图层 ${layer.id}。`);
    }
    layerIds.add(layer.id);
  }

  const objectIds = new Set();
  for (const object of scene.objects) {
    assertText(object?.id, `${scene.id}.objects[].id`);
    assertText(object?.label, `${scene.id}.${object.id}.label`);
    assertRect(object?.hitArea, `${scene.id}.${object.id}.hitArea`);
    if (object.movable !== undefined && typeof object.movable !== "boolean") {
      throw new TypeError(`${scene.id}.${object.id}.movable 必须是布尔值。`);
    }
    if (object.visualSource || object.visualSourceByPhase) {
      assertPhaseSource(
        object.visualSourceByPhase ?? object.visualSource,
        `${scene.id}.${object.id}.visualSource`,
      );
    }
    if (object.action) {
      if (!new Set(["close", "feature", "scene"]).has(object.action.type)) {
        throw new TypeError(`${scene.id}.${object.id}.action.type 不是支持的动作类型。`);
      }
      if (object.action.type !== "close") {
        assertText(object.action.target, `${scene.id}.${object.id}.action.target`);
      }
    }
    if (objectIds.has(object.id)) {
      throw new TypeError(`${scene.id} 中存在重复对象 ${object.id}。`);
    }
    objectIds.add(object.id);
  }

  if (scene.initialFocusObjectId && !objectIds.has(scene.initialFocusObjectId)) {
    throw new TypeError(`${scene.id}.initialFocusObjectId 指向了不存在的对象。`);
  }
  return deepFreeze(scene);
}

export function createSceneRegistry(definitions) {
  if (!Array.isArray(definitions) || !definitions.length) {
    throw new TypeError("场景注册表至少需要一个场景定义。");
  }
  const scenes = new Map();
  for (const definition of definitions) {
    const scene = validateScene(definition);
    if (scenes.has(scene.id)) throw new TypeError(`存在重复场景 ${scene.id}。`);
    scenes.set(scene.id, scene);
  }
  for (const scene of scenes.values()) {
    for (const object of scene.objects) {
      if (object.action?.type === "scene" && !scenes.has(object.action.target)) {
        throw new TypeError(`${scene.id}.${object.id} 指向了未注册场景 ${object.action.target}。`);
      }
    }
  }

  return Object.freeze({
    get(sceneId) {
      const scene = scenes.get(sceneId);
      if (!scene) throw new Error(`未注册场景：${sceneId}`);
      return scene;
    },
    has(sceneId) {
      return scenes.has(sceneId);
    },
    list() {
      return [...scenes.values()];
    },
  });
}

export function resolvePhaseValue(value, phase) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  return value[phase] ?? value.default ?? null;
}
