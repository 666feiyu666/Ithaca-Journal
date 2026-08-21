export const dialogues = Object.freeze({
  "doorway.mailbox": {
    id: "doorway.mailbox",
    lines: [
      {
        speaker: "我",
        textByPhase: {
          morning: "晨光落在信箱盖上。里面似乎多了一封信。",
          dusk: "信箱被黄昏染成暗金色。里面似乎多了一封信。",
          lateNight: "门外很安静。信箱里似乎有什么东西。",
        },
      },
    ],
    actionLabel: "拆开来信",
  },
  "doorway.enterRoom": {
    id: "doorway.enterRoom",
    lines: [{ speaker: "我", text: "钥匙还握在手里。先进去看看吧。" }],
    actionLabel: "进入房间",
  },
  "room.desk": {
    id: "room.desk",
    lines: [
      {
        speaker: "我",
        textByPhase: {
          morning: "纸页在早晨的光线里显得很干净。",
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
    lines: [{ speaker: "我", text: "门外还有那只旧信箱。" }],
    actionLabel: "走到门外",
  },
});
