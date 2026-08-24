# Room scene assets

The room scene currently uses the shared 1456 × 816 source camera.

| File | Required | Layer responsibility |
| --- | --- | --- |
| `background-base.webp` | Yes, final art | Empty walls, floor and architectural shell. |
| `rug.png` | Yes, final art | Fixed floor decoration below all furniture. |
| `door-closed.png` | Yes, final art | Room-side door and doorway interaction. |
| `bulletin-board.png` | Yes, final art | Fixed wall decoration behind the writing area. |
| `bookshelf.png` | Yes, final art | Movable bookshelf and library interaction. |
| `plant.png` | Yes, final art | Movable room decoration. |
| `desk-closed.png` | Yes, final art | Movable writing desk and workbench interaction. |
| `lamp-off.png` | Yes, final art | Movable desk-lamp decoration. |
| `chair-back.png` | Yes, final art | Movable chair decoration above the desk layer. |
| `room-placeholder-v01.png` | Historical fallback | Migrated 0.1.0 composite image; no longer loaded by the default scene. |

The production arrangement mirrors `art-source/0.4.0/scenes/room/03-decompose/decomposition-r004/layout.json`. Decorative layers do not receive focus or pointer input while exploring; movable layers become operable in arrangement mode.

Only production-ready exports belong in this directory. Keep source artwork, processing tools, and verification workflows in the local development environment. Recalibrate `hitArea` and `hintAnchor` when a replacement changes the agreed camera composition.
