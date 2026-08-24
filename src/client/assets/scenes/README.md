# Scene asset contract

This directory is the production asset root for the 0.4.0 visual-novel scene system. Runtime URLs start with `/assets/scenes/`.

```text
scenes/
├── doorway/
│   ├── background-base.webp   # empty corridor shell and wall decoration
│   ├── door.png               # room-entry interaction
│   ├── lamp.png               # fixed corridor decoration
│   └── mailbox.png            # letter interaction
└── room/
    ├── background-base.webp   # empty room shell
    ├── rug.png                # fixed floor decoration
    ├── door-closed.png        # doorway interaction
    ├── bulletin-board.png     # fixed wall decoration
    ├── bookshelf.png          # library interaction, movable
    ├── plant.png              # movable decoration
    ├── desk-closed.png        # writing interaction, movable
    ├── lamp-off.png           # movable decoration
    └── chair-back.png         # movable decoration
```

The committed `room/room-placeholder-v01.png` is retained only as a historical fallback. Runtime scenes now use the processed assets listed above.

## Shared export rules

- Logical scene ratio: approximately 16:9. The current Midjourney sources and runtime backgrounds are 1456 × 816; the build does not upscale them without adding detail.
- Backgrounds: WebP, opaque, full source canvas.
- Scene objects: tightly cropped transparent PNG with stable padding. Their placement, stacking and rendered size are controlled by the scene object's `hitArea` and `z`.
- Decorative objects use `interactive: false`; they do not intercept exploration input, but movable decorations become available in arrangement mode.
- Use lowercase kebab-case filenames and do not add version suffixes to final files.
- Keep prompts, source files, third-party references, and local processing tools outside the runtime directory. Only production-cleared exports belong here.
- Missing time-of-day variants must fall back to the base asset; do not duplicate the base image for every phase.
