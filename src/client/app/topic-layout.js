const MAX_TOPIC_FRAGMENTS = 50;
const PUZZLE_SLOT_COUNT = 50;

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
  return Math.abs(hash) % PUZZLE_SLOT_COUNT;
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
      && fragment.shape_variant < PUZZLE_SLOT_COUNT
      ? fragment.shape_variant
      : shapeVariantFor(seed, fragment.id),
    is_snapped: fragment.is_snapped === true || fragment.is_snapped === 1,
  };
}

export function assignPuzzleSlots(fragments, pieceCount) {
  if (!Number.isInteger(pieceCount) || pieceCount < 1) return fragments;
  const used = new Set();
  return [...fragments]
    .sort((left, right) => left.position - right.position)
    .map((fragment, position) => {
      if (position >= pieceCount) return { ...fragment, position };
      let slot = fragment.shape_variant;
      if (!Number.isInteger(slot) || slot < 0 || slot >= pieceCount || used.has(slot)) {
        slot = 0;
        while (used.has(slot) && slot < pieceCount) slot += 1;
      }
      used.add(slot);
      return { ...fragment, position, shape_variant: slot };
    });
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
    items: [...fragments]
      .sort((left, right) => left.position - right.position)
      .map((fragment, position) => ({
      fragment_id: fragment.id,
      canvas_x: clampUnit(Number(fragment.canvas_x)),
      canvas_y: clampUnit(Number(fragment.canvas_y)),
      z_index: Number.isInteger(fragment.z_index) ? fragment.z_index : position,
      shape_variant: Number.isInteger(fragment.shape_variant)
        ? fragment.shape_variant
        : 0,
      is_snapped: fragment.is_snapped === true,
    })),
  };
}

export function puzzleFrame(boardSize, puzzleCanvas) {
  const margin = Math.min(40, boardSize.width * 0.06, boardSize.height * 0.06);
  const availableWidth = Math.max(1, boardSize.width - (margin * 2));
  const availableHeight = Math.max(1, boardSize.height - (margin * 2));
  const aspectRatio = puzzleCanvas.width / puzzleCanvas.height;
  const width = Math.min(availableWidth, availableHeight * aspectRatio, 900);
  const height = width / aspectRatio;
  return {
    left: (boardSize.width - width) / 2,
    top: (boardSize.height - height) / 2,
    width,
    height,
    scale: width / puzzleCanvas.width,
  };
}

export function puzzlePieceMetrics(pieceBounds, puzzleCanvas, boardSize) {
  const frame = puzzleFrame(boardSize, puzzleCanvas);
  const width = pieceBounds.width * frame.scale;
  const height = pieceBounds.height * frame.scale;
  const left = frame.left + ((pieceBounds.x - puzzleCanvas.x) * frame.scale);
  const top = frame.top + ((pieceBounds.y - puzzleCanvas.y) * frame.scale);
  return {
    left,
    top,
    width,
    height,
    canvas_x: clampUnit(left / Math.max(1, boardSize.width - width)),
    canvas_y: clampUnit(top / Math.max(1, boardSize.height - height)),
    scale: frame.scale,
  };
}

export function snapPuzzlePlacement(
  placement,
  pieceBounds,
  puzzleCanvas,
  boardSize,
) {
  const target = puzzlePieceMetrics(pieceBounds, puzzleCanvas, boardSize);
  const candidate = pixelPosition(placement, boardSize, {
    width: target.width,
    height: target.height,
  });
  const distance = Math.hypot(candidate.left - target.left, candidate.top - target.top);
  const threshold = Math.min(56, Math.max(28, target.scale * 12));
  if (distance > threshold) {
    return { ...placement, is_snapped: false };
  }
  return {
    canvas_x: target.canvas_x,
    canvas_y: target.canvas_y,
    is_snapped: true,
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
