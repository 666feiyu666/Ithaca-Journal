import test from "node:test";
import assert from "node:assert/strict";

import {
  assignPuzzleSlots,
  autoArrangeTopicFragments,
  normalizeTopicFragment,
  pixelPosition,
  placementFromPointer,
  puzzlePieceMetrics,
  shapeVariantFor,
  snapPuzzlePlacement,
  toTopicLayoutPayload,
} from "../../src/client/app/topic-layout.js";
import {
  SUNSET_GRID_12_PATHS,
  SUNSET_GRID_12_PIECES,
} from "../../src/client/assets/puzzles/sunset-grid-12-paths.js";
import { PUZZLE_CATALOG } from "../../src/client/config/puzzles.js";

test("shape slots are stable and stay inside the topic storage range", () => {
  const first = shapeVariantFor("topic-seed", "fragment-1");
  assert.equal(first, shapeVariantFor("topic-seed", "fragment-1"));
  assert.ok(first >= 0 && first < 50);
});

test("the first shop product contains twelve closed individual contours", () => {
  assert.equal(PUZZLE_CATALOG[0].pieceCount, 12);
  assert.equal(SUNSET_GRID_12_PATHS.length, 12);
  assert.ok(SUNSET_GRID_12_PATHS.every((path) => path.startsWith("M") && /Z$/i.test(path)));
  assert.ok(SUNSET_GRID_12_PIECES.every(({ bounds }) => bounds.width > 0 && bounds.height > 0));
});

test("normalization accepts every storage slot and replaces out-of-range variants", () => {
  const retained = normalizeTopicFragment({
    id: "fragment-1",
    shape_variant: 49,
  }, 0, "topic-seed");
  const replaced = normalizeTopicFragment({
    id: "fragment-1",
    shape_variant: 50,
  }, 0, "topic-seed");
  assert.equal(retained.shape_variant, 49);
  assert.equal(replaced.shape_variant, shapeVariantFor("topic-seed", "fragment-1"));
});

test("auto arrangement creates bounded, ordered positions", () => {
  const arranged = autoArrangeTopicFragments(
    Array.from({ length: 9 }, (_, index) => ({ id: `fragment-${index}` })),
  );
  assert.equal(arranged.length, 9);
  assert.deepEqual(arranged.map(({ z_index }) => z_index), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(arranged.every(({ canvas_x, canvas_y }) => (
    canvas_x >= 0 && canvas_x <= 1 && canvas_y >= 0 && canvas_y <= 1
  )));
});

test("puzzle slots remain unique and reuse a missing slot", () => {
  const assigned = assignPuzzleSlots([
    { id: "a", position: 0, shape_variant: 0 },
    { id: "b", position: 1, shape_variant: 2 },
    { id: "c", position: 2, shape_variant: 2 },
  ], 3);
  assert.deepEqual(assigned.map(({ shape_variant }) => shape_variant), [0, 2, 1]);
});

test("a piece close to its solved coordinates snaps into the shared image frame", () => {
  const canvas = { x: 0, y: 0, width: 300, height: 169 };
  const board = { width: 1_000, height: 650 };
  const bounds = SUNSET_GRID_12_PIECES[0].bounds;
  const target = puzzlePieceMetrics(bounds, canvas, board);
  const placement = snapPuzzlePlacement({
    canvas_x: target.canvas_x + 0.01,
    canvas_y: target.canvas_y + 0.01,
  }, bounds, canvas, board);
  assert.equal(placement.is_snapped, true);
  assert.equal(placement.canvas_x, target.canvas_x);
  assert.equal(placement.canvas_y, target.canvas_y);
});

test("pointer and pixel conversions keep a piece inside its board", () => {
  const boardRect = { left: 100, top: 50, width: 800, height: 500 };
  const pieceSize = { width: 224, height: 152 };
  const placement = placementFromPointer(
    { clientX: 1_000, clientY: 1_000 },
    boardRect,
    pieceSize,
  );
  assert.deepEqual(placement, { canvas_x: 1, canvas_y: 1 });
  assert.deepEqual(
    pixelPosition(placement, boardRect, pieceSize),
    { left: 576, top: 348 },
  );
});

test("layout payload preserves membership and normalized positions", () => {
  const payload = toTopicLayoutPayload([{
    id: "fragment-1",
    canvas_x: 1.4,
    canvas_y: -0.2,
    z_index: 7,
    shape_variant: 12,
    is_snapped: true,
  }]);
  assert.deepEqual(payload.items[0], {
    fragment_id: "fragment-1",
    canvas_x: 1,
    canvas_y: 0,
    z_index: 7,
    shape_variant: 12,
    is_snapped: true,
  });
});
