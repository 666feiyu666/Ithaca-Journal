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
      alt: "公寓门外的走廊：左侧是信箱所在的空墙，右侧是房门。",
      z: 0,
    },
  ],
  objects: [
    {
      id: "mailbox",
      label: "信箱",
      kind: "feature",
      visualSource: sceneAssets.doorway.mailbox,
      hitArea: { x: 14, y: 35, width: 20, height: 24 },
      hintAnchor: { x: 24, y: 34 },
      hint: { title: "查看信箱", text: "里面似乎多了一封信" },
      dialogueId: "doorway.mailbox",
      action: { type: "feature", target: "openLetter" },
    },
    {
      id: "door",
      label: "房门",
      kind: "scene",
      hitArea: { x: 58, y: 3, width: 26, height: 92 },
      hintAnchor: { x: 71, y: 8 },
      hint: { title: "进入房间", text: "推门回到书写的地方" },
      dialogueId: "doorway.enterRoom",
      action: { type: "scene", target: "room" },
    },
  ],
});
