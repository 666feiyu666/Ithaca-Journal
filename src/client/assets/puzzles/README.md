# Puzzle product assets

`sunset-grid-12-paths.js` contains the 12 closed contours for the first puzzle
shop product, **Sunset Grid · 12**. `sunset-grid-12-artwork.jpg` is the single
shared picture cropped through those contours at runtime.

- Source: `puzzle_pieces_svg_4x3.zip`, exported by the user from JigsawMake
- Export option: `Pieces SVG (ZIP)`
- Layout: 4 columns × 3 rows
- Processing: retain the first path inside each SVG's `clipPath`, calculate its
  original global-coordinate bounds, extract one copy of the identical embedded
  JPEG, and omit the other 11 JPEG copies plus duplicate display strokes
- Intended use: product prototype for version 0.3.0
- Rights status: user-supplied export; public redistribution terms still need
  to be confirmed before a public release

The source ZIP is not committed because each file embeds a large copy of the
original image. Extract the ZIP to an ignored directory and regenerate the
compact contour module with:

```powershell
node scripts/extract-puzzle-shapes.mjs <directory-containing-piece-svgs>
```

The 50-note topic capacity is independent from a product's piece count. Each
future shop product provides its own contour set and unlock requirement.
