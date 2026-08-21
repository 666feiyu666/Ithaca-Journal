# 0.2.0 scene source art

`raw/` contains the unmodified Midjourney exports supplied for the 0.2.0 room and doorway scenes. Runtime code must never reference this directory directly.

| Stable source name | Original download |
| --- | --- |
| `room-background.png` | `frank_A_quiet_small_rental_apartment_room_for_a_2D_visual_nov_2989c9e6-0994-42e7-b83d-9f2134bdde35_3.png` |
| `doorway-background.png` | `frank_Small_apartment_landing_outside_a_rental_room_for_a_2D__2d08dceb-93f8-4b4e-905b-29d05ff9d237_0.png` |
| `desk-chair.png` | `frank_A_modest_old_wooden_writing_desk_with_one_matching_wood_d72d022e-8b19-493f-90a6-1ee6aaed9066_3.png` |
| `bookshelf.png` | `frank_A_tall_slightly_worn_wooden_bookshelf_isolated_2D_visua_7bb43377-2298-4819-b094-3ac9d31e1e6c_2.png` |
| `mailbox.png` | `frank_Small_wall_mounted_apartment_mailbox._Single_isolated_2_880ddd49-4f7e-4fd2-bed7-594a2cd5710e_3.png` |

The build pipeline reads these files without modifying them:

```powershell
npm run assets:build
npm run assets:check
```

Processed runtime files are written to `src/client/assets/scenes/`. Review composites and checkerboard previews are written to `.artifacts/asset-review/`.
