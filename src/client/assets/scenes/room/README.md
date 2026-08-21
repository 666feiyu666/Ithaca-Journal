# Room scene assets

The room scene currently uses the shared 1456 × 816 source camera.

| File | Required | Layer responsibility |
| --- | --- | --- |
| `background-base.webp` | Yes, final art | Walls, floor and room-side door. Do not bake in the desk, chair or bookshelf. |
| `desk-chair.png` | Yes, final art | Desk and chair as one transparent interactive layer. |
| `bookshelf.png` | Yes, final art | Bookshelf as one transparent interactive layer. |
| `room-placeholder-v01.png` | Historical fallback | Migrated 0.1.0 composite image; no longer loaded by the default scene. |

Only production-ready exports belong in this directory. Keep source artwork, processing tools, and verification workflows in the local development environment. Recalibrate `hitArea` and `hintAnchor` when a replacement changes the agreed camera composition.
