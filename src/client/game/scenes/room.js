import { sceneAssets } from "../scene-assets.js";

export const roomScene = Object.freeze({
  id: "room",
  title: "今夜想从哪里开始？",
  eyebrow: "你的房间",
  description: "书桌保存书写，书架收藏成书；房门通向门外的信箱。",
  aspectRatio: 1456 / 816,
  initialFocusObjectId: "desk",
  layers: [
    {
      id: "background",
      type: "image",
      source: sceneAssets.room.background,
      alt: "正视房间：左侧是书架，中央是书桌，右侧是房门。",
      z: 0,
    },
  ],
  objects: [
    {
      id: "bookshelf",
      label: "书架",
      kind: "feature",
      visualSource: sceneAssets.room.bookshelf,
      hitArea: { x: 3.5, y: 15, width: 28.5, height: 72 },
      hintAnchor: { x: 17.75, y: 16 },
      hint: { title: "打开书架", text: "翻看整理过的故事" },
      dialogueId: "room.bookshelf",
      action: { type: "feature", target: "openBookshelf" },
    },
    {
      id: "desk",
      label: "书桌",
      kind: "feature",
      visualSource: sceneAssets.room.deskChair,
      hitArea: { x: 29, y: 42, width: 48, height: 50 },
      hintAnchor: { x: 53, y: 42 },
      hint: { title: "前往书桌", text: "纸页还在等你" },
      dialogueId: "room.desk",
      action: { type: "feature", target: "openWorkbench" },
    },
    {
      id: "door",
      label: "房门",
      kind: "scene",
      hitArea: { x: 81.5, y: 14, width: 15.5, height: 64 },
      hintAnchor: { x: 89.25, y: 15 },
      hint: { title: "走到门外", text: "旧信箱就在门外" },
      dialogueId: "room.leave",
      action: { type: "scene", target: "doorway" },
    },
  ],
});
