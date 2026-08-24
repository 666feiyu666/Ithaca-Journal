# Doorway scene assets

The doorway scene currently uses the shared 1456 × 816 source camera.

| File | Required | Layer responsibility |
| --- | --- | --- |
| `background-base.webp` | Yes, final art | Corridor shell, wall drawings and vine. Do not bake in the door, lamp or mailbox. |
| `door.png` | Yes, final art | Exterior side of the room door and the room-entry interaction. |
| `lamp.png` | Yes, final art | Fixed wall-lamp decoration. |
| `mailbox.png` | Yes, final art | Mailbox as one transparent interactive layer. |

The production arrangement mirrors `art-source/0.4.0/scenes/corridor/03-decompose/decomposition-r003/layout.json`.

Only production-ready exports belong in this directory. Keep source artwork, processing tools, and verification workflows in the local development environment. Recalibrate `hitArea` and `hintAnchor` when a replacement changes the agreed camera composition.
