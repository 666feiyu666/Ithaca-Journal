# Doorway scene assets

The doorway scene currently uses the shared 1456 × 816 source camera.

| File | Required | Layer responsibility |
| --- | --- | --- |
| `background-base.webp` | Yes, final art | Corridor wall, floor and exterior side of the room door. Do not bake in the mailbox. |
| `mailbox.png` | Yes, final art | Mailbox as one transparent interactive layer. |

The door may remain part of the background image in 0.2.0 because its interactive button and hit area are already independent from the pixels.

Replacement steps:

1. Put unmodified replacements in `art-source/0.2.0/scenes/raw/` using the stable source filenames.
2. Run `npm run assets:build`; the mailbox is exported as a tightly cropped transparent PNG.
3. Run `npm run assets:check` to reject missing or stale outputs.
4. Recalibrate `hitArea` and `hintAnchor` only if the replacement composition differs from the agreed camera.
5. Run `npm run check`, `npm test`, and `npm run test:visual`.
