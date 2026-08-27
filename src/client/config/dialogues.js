export const dialogues = Object.freeze({
  "journey.intro": {
    id: "journey.intro",
    dismissible: false,
    lines: [
      { speaker: "我", text: "（拖着行李箱的声音）呼……终于到了。" },
      { speaker: "我", text: "看着手机上的导航，应该就是这里没错了。" },
      { speaker: "我", text: "刚来到这座陌生城市，能找到这个安静的单间，已经很幸运了。" },
      { speaker: "我", text: "总之先住下来吧。" },
    ],
    actionLabel: "开始探索",
  },
  "doorway.mailbox": {
    id: "doorway.mailbox",
    lines: [{ speaker: "我", text: "这里保存写下并寄出的信，也可以从寄件重新建立草稿。" }],
    actionLabel: "打开寄件箱",
  },
  "doorway.enterRoom": {
    id: "doorway.enterRoom",
    lines: [{ speaker: "我", text: "回到房间里吧。" }],
    actionLabel: "进入房间",
  },
  "room.desk": {
    id: "room.desk",
    lines: [
      {
        speaker: "我",
        textByPhase: {
          morning: "纸页在早晨的光线里显得很干净。",
          afternoon: "午后的光停在桌沿，也许正适合写下此刻。",
          dusk: "天色渐暗，也许正适合整理今天的片段。",
          lateNight: "台灯照亮了桌面上仅剩的一小块地方。",
        },
      },
    ],
    actionLabel: "开始书写",
  },
  "room.bookshelf": {
    id: "room.bookshelf",
    lines: [{ speaker: "我", text: "已经有一些零散的声音被整理到这里了。" }],
    actionLabel: "打开书架",
  },
  "room.leave": {
    id: "room.leave",
    lines: [{ speaker: "我", text: "信箱在门外，可以在那里整理寄件。" }],
    actionLabel: "走到门外",
  },
});
