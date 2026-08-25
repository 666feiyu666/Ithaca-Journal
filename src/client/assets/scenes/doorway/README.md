# Doorway scene assets

The doorway scene currently uses the shared 1456 × 816 source camera.

| File | Required | Layer responsibility |
| --- | --- | --- |
| `background-base.webp` | Yes, final art | Corridor shell, wall drawings and vine. Do not bake in the door, lamp or mailbox. |
| `door.png` | Yes, final art | Exterior side of the room door and the room-entry interaction. |
| `lamp.png` | Yes, final art | Human-approved OFF-state wall lamp, regenerated from the `image-r007` design on a flat magenta background, chroma-keyed to real Alpha, and normalized to 486 × 669. |
| `lamp-on.png` | Yes, final art | Human-approved ON-state wall lamp using `image-r005` as its lighting reference and normalized to the same 486 × 669 canvas. |
| `mailbox.png` | Yes, final art | Human-approved mailbox regenerated from the `image-r007` design on a flat magenta background, chroma-keyed to real Alpha, edge-decontaminated, and normalized to 571 × 691. |

The production arrangement mirrors `art-source/0.4.0/scenes/corridor/03-decompose/decomposition-r003/layout.json`. Interaction-state candidate history and approval evidence live under `art-source/0.4.0/scenes/corridor/05-interaction-states/`.

Only production-ready exports belong in this directory. Keep source artwork, processing tools, and verification workflows in the local development environment. Recalibrate `hitArea` and `hintAnchor` when a replacement changes the agreed camera composition.
