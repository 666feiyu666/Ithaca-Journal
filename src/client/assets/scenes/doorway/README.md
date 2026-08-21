# Doorway scene assets

The doorway scene currently uses the shared 1456 × 816 source camera.

| File | Required | Layer responsibility |
| --- | --- | --- |
| `background-base.webp` | Yes, final art | Corridor wall, floor and exterior side of the room door. Do not bake in the mailbox. |
| `mailbox.png` | Yes, final art | Mailbox as one transparent interactive layer. |

The door may remain part of the background image in 0.2.0 because its interactive button and hit area are already independent from the pixels.

Only production-ready exports belong in this directory. Keep source artwork, processing tools, and verification workflows in the local development environment. Recalibrate `hitArea` and `hintAnchor` when a replacement changes the agreed camera composition.
