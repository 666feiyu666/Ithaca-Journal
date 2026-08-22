import { SUNSET_GRID_12_PIECES } from "../assets/puzzles/sunset-grid-12-paths.js";

export const PUZZLE_CATALOG = Object.freeze([
  Object.freeze({
    id: "sunset-grid-12",
    title: "落日方格 · 十二片",
    pieceCount: 12,
    canvasViewBox: "-5 -5 310 179",
    canvas: Object.freeze({ x: 0, y: 0, width: 300, height: 169 }),
    artworkHref: "/assets/puzzles/sunset-grid-12-artwork.jpg",
    pieces: SUNSET_GRID_12_PIECES,
  }),
]);

export function puzzleDefinitionFor(puzzleId) {
  return PUZZLE_CATALOG.find(({ id }) => id === puzzleId) ?? null;
}
