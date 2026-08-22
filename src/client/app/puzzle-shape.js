import { puzzleDefinitionFor } from "../config/puzzles.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
let clipSequence = 0;

export function createPuzzleShape(puzzleId, pieceIndex) {
  const puzzle = puzzleDefinitionFor(puzzleId);
  const piece = Number.isInteger(pieceIndex) ? puzzle?.pieces[pieceIndex] : null;
  if (!puzzle || !piece) {
    return null;
  }
  clipSequence += 1;
  const clipId = `topic-piece-clip-${clipSequence}`;
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.classList.add("topic-piece__shape");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute(
    "viewBox",
    `${piece.bounds.x} ${piece.bounds.y} ${piece.bounds.width} ${piece.bounds.height}`,
  );
  svg.dataset.boundsX = String(piece.bounds.x);
  svg.dataset.boundsY = String(piece.bounds.y);
  svg.dataset.boundsWidth = String(piece.bounds.width);
  svg.dataset.boundsHeight = String(piece.bounds.height);

  const definitions = document.createElementNS(SVG_NAMESPACE, "defs");
  const clipPath = document.createElementNS(SVG_NAMESPACE, "clipPath");
  clipPath.id = clipId;
  clipPath.setAttribute("clipPathUnits", "userSpaceOnUse");
  const clipContour = document.createElementNS(SVG_NAMESPACE, "path");
  clipContour.setAttribute("d", piece.path);
  clipPath.append(clipContour);
  definitions.append(clipPath);

  const artwork = document.createElementNS(SVG_NAMESPACE, "image");
  artwork.classList.add("topic-piece__artwork");
  artwork.setAttribute("href", puzzle.artworkHref);
  artwork.setAttribute("x", String(puzzle.canvas.x));
  artwork.setAttribute("y", String(puzzle.canvas.y));
  artwork.setAttribute("width", String(puzzle.canvas.width));
  artwork.setAttribute("height", String(puzzle.canvas.height));
  artwork.setAttribute("preserveAspectRatio", "xMidYMid slice");
  artwork.setAttribute("clip-path", `url(#${clipId})`);

  const outline = document.createElementNS(SVG_NAMESPACE, "path");
  outline.classList.add("topic-piece__outline");
  outline.setAttribute("d", piece.path);
  outline.setAttribute("vector-effect", "non-scaling-stroke");
  svg.append(definitions, artwork, outline);
  return svg;
}

export function createPuzzlePreview(puzzleId) {
  const puzzle = puzzleDefinitionFor(puzzleId);
  if (!puzzle) return null;
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.classList.add("puzzle-product-preview");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("viewBox", puzzle.canvasViewBox);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const artwork = document.createElementNS(SVG_NAMESPACE, "image");
  artwork.setAttribute("href", puzzle.artworkHref);
  artwork.setAttribute("x", String(puzzle.canvas.x));
  artwork.setAttribute("y", String(puzzle.canvas.y));
  artwork.setAttribute("width", String(puzzle.canvas.width));
  artwork.setAttribute("height", String(puzzle.canvas.height));
  artwork.setAttribute("preserveAspectRatio", "xMidYMid slice");
  svg.append(artwork);
  for (const piece of puzzle.pieces) {
    const path = document.createElementNS(SVG_NAMESPACE, "path");
    path.setAttribute("d", piece.path);
    path.setAttribute("vector-effect", "non-scaling-stroke");
    svg.append(path);
  }
  return svg;
}

export function fitPuzzleShapes(root) {
  for (const svg of root.querySelectorAll(".topic-piece__shape")) {
    svg.dataset.fitted = "true";
  }
}
