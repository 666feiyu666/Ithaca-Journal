const MAX_TOPIC_FRAGMENTS = 50;

export function clampUnit(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function shapeVariantFor(seed, fragmentId) {
  const source = `${seed}:${fragmentId}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 16;
}

export function normalizeTopicFragment(fragment, index = 0, seed = "") {
  return {
    ...fragment,
    canvas_x: clampUnit(Number(fragment.canvas_x ?? 0.08)),
    canvas_y: clampUnit(Number(fragment.canvas_y ?? 0.08)),
    z_index: Number.isInteger(fragment.z_index) && fragment.z_index >= 0
      ? fragment.z_index
      : index,
    shape_variant: Number.isInteger(fragment.shape_variant)
      && fragment.shape_variant >= 0
      && fragment.shape_variant <= 15
      ? fragment.shape_variant
      : shapeVariantFor(seed, fragment.id),
  };
}

export function autoArrangeTopicFragments(fragments) {
  const count = Math.min(fragments.length, MAX_TOPIC_FRAGMENTS);
  if (!count) return [];
  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(count * 1.35))));
  const rows = Math.ceil(count / columns);
  return fragments.map((fragment, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      ...fragment,
      canvas_x: columns === 1 ? 0.08 : column / (columns - 1),
      canvas_y: rows === 1 ? 0.08 : row / (rows - 1),
      z_index: index,
    };
  });
}

export function nextTopicPlacement(count) {
  const column = count % 4;
  const row = Math.floor(count / 4);
  return {
    canvas_x: clampUnit(column / 3),
    canvas_y: clampUnit(row * 0.14),
    z_index: count,
  };
}

export function toTopicLayoutPayload(fragments) {
  return {
    items: fragments.map((fragment, position) => ({
      fragment_id: fragment.id,
      canvas_x: clampUnit(Number(fragment.canvas_x)),
      canvas_y: clampUnit(Number(fragment.canvas_y)),
      z_index: Number.isInteger(fragment.z_index) ? fragment.z_index : position,
      shape_variant: Number.isInteger(fragment.shape_variant)
        ? fragment.shape_variant
        : 0,
    })),
  };
}

export function placementFromPointer({ clientX, clientY }, boardRect, pieceSize) {
  const availableWidth = Math.max(1, boardRect.width - pieceSize.width);
  const availableHeight = Math.max(1, boardRect.height - pieceSize.height);
  return {
    canvas_x: clampUnit((clientX - boardRect.left - (pieceSize.width / 2)) / availableWidth),
    canvas_y: clampUnit((clientY - boardRect.top - (pieceSize.height / 2)) / availableHeight),
  };
}

export function pixelPosition(fragment, boardSize, pieceSize) {
  return {
    left: Math.round(clampUnit(fragment.canvas_x) * Math.max(0, boardSize.width - pieceSize.width)),
    top: Math.round(clampUnit(fragment.canvas_y) * Math.max(0, boardSize.height - pieceSize.height)),
  };
}
