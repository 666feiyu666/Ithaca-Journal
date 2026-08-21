# Scene asset contract

This directory is the production asset root for the 0.2.0 visual-novel scene system. Runtime URLs start with `/assets/scenes/`.

```text
scenes/
├── doorway/
│   ├── background-base.webp   # corridor and door background
│   └── mailbox.png            # transparent interactive object
└── room/
    ├── background-base.webp   # room shell and door background
    ├── desk-chair.png         # transparent interactive object
    └── bookshelf.png          # transparent interactive object
```

The committed `room/room-placeholder-v01.png` is retained only as a historical fallback. Runtime scenes now use the processed assets listed above.

## Shared export rules

- Logical scene ratio: approximately 16:9. The current Midjourney sources and runtime backgrounds are 1456 × 816; the build does not upscale them without adding detail.
- Backgrounds: WebP, opaque, full source canvas.
- Interactive objects: tightly cropped transparent PNG with stable padding. Their placement and rendered size are controlled by the scene object's `hitArea`.
- Use lowercase kebab-case filenames and do not add version suffixes to final files.
- Keep prompts, source files, and third-party references outside the runtime directory. Only production-cleared exports belong here.
- Missing time-of-day variants must fall back to the base asset; do not duplicate the base image for every phase.

Raw Midjourney exports live outside the runtime tree in `art-source/0.2.0/scenes/raw/`. Rebuild and verify the production files with `npm run assets:build` and `npm run assets:check`.
