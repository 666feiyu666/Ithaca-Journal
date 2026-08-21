# Room scene assets

The room scene currently uses the shared 1456 × 816 source camera.

| File | Required | Layer responsibility |
| --- | --- | --- |
| `background-base.webp` | Yes, final art | Walls, floor and room-side door. Do not bake in the desk, chair or bookshelf. |
| `desk-chair.png` | Yes, final art | Desk and chair as one transparent interactive layer. |
| `bookshelf.png` | Yes, final art | Bookshelf as one transparent interactive layer. |
| `room-placeholder-v01.png` | Historical fallback | Migrated 0.1.0 composite image; no longer loaded by the default scene. |

Replacement steps:

1. Put unmodified replacements in `art-source/0.2.0/scenes/raw/` using the stable source filenames.
2. Run `npm run assets:build`; the pipeline removes the sampled background, softens and decontaminates edges, tightly crops objects, and preserves padding.
3. Run `npm run assets:check` to reject missing or stale outputs.
4. Recalibrate `hitArea` and `hintAnchor` only if the replacement composition differs from the agreed camera.
5. Run `npm run check`, `npm test`, and `npm run test:visual`.
