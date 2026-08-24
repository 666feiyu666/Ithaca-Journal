import { sceneAssets } from "../scene-assets.js";

export const doorwayScene = Object.freeze({
  id: "doorway",
  title: "门外",
  eyebrow: "公寓门外",
  description: "信件留在门外，推开房门才能回到书写的地方。",
  aspectRatio: 1456 / 816,
  initialFocusObjectId: "mailbox",
  layers: [
    {
      id: "background",
      type: "image",
      source: sceneAssets.doorway.background,
      alt: "安静温暖的公寓走廊，藤蔓沿左侧墙面生长，信箱与房门位于右侧。",
      z: 0,
    },
  ],
  objects: [
    {
      id: "door",
      label: "房门",
      kind: "scene",
      visualSource: sceneAssets.doorway.door,
      hitArea: { x: 74.18, y: 14.95, width: 20.05, height: 74.25 },
      hintAnchor: { x: 84.2, y: 17 },
      hint: { title: "进入房间", text: "推门回到书写的地方" },
      dialogueId: "doorway.enterRoom",
      action: { type: "scene", target: "room" },
      z: 10,
    },
    {
      id: "lamp",
      label: "走廊壁灯",
      kind: "decor",
      interactive: false,
      visualSource: sceneAssets.doorway.lamp,
      hitArea: { x: 67.08, y: 24.15, width: 5.05, height: 11.55 },
      z: 20,
    },
    {
      id: "mailbox",
      label: "信箱",
      kind: "feature",
      visualSource: sceneAssets.doorway.mailbox,
      hitArea: { x: 66.48, y: 42.75, width: 6.35, height: 13.05 },
      hintAnchor: { x: 69.65, y: 41.75 },
      hint: { title: "查看信箱", text: "里面似乎多了一封信" },
      dialogueId: "doorway.mailbox",
      action: { type: "feature", target: "openLetter" },
      z: 30,
    },
  ],
});
