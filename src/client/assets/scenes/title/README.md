# Title scene production assets

Runtime title artwork promoted from:

`art-source/0.4.0/scenes/title/00-candidates/sky-rooftop-r001/`

All three 1675 × 939 PNG files share an invariant camera, rooftop geometry, skyline, cloud layout, and central UI-safe region. The morning master was approved on 2026-08-24; the complete time set was subsequently requested for runtime adoption on the same date.

## Runtime contract

| Time phase | Clock range | Asset | Runtime treatment |
| --- | --- | --- | --- |
| `morning` | 05:00–11:59 | `title-morning.png` | light neutral grade |
| `afternoon` | 12:00–16:59 | `title-morning.png` | restrained warm grade; no duplicate bitmap |
| `dusk` | 17:00–21:59 | `title-dusk.png` | dusk grade |
| `lateNight` | 22:00–04:59 | `title-late-night.png` | quiet night grade plus the existing CSS star layer |

The mapping is expressed with `html[data-time-phase]` selectors. `renderSceneTime` owns that attribute, so the title responds to the same minute/focus/visibility updates as the room clock without a second time source.

Artwork is non-interactive and marked `aria-hidden`; all readable content and actions remain in semantic HTML.
