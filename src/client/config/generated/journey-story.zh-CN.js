// Generated from narrative/journey/story.zh-CN.twee. Do not edit by hand.

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export const journeyStory = deepFreeze({
  "title": "《伊萨卡手记》｜Journey",
  "ifid": "D5C46D78-CE67-4EC8-9E6C-36BE4DB0E88E",
  "revision": "draft-02",
  "start": "PROLOGUE_S01",
  "chapters": {
    "prologue": {
      "label": "序章",
      "title": "陌生城市与设计稿"
    },
    "chapter-1": {
      "label": "第一章",
      "title": "等待回复"
    },
    "chapter-2": {
      "label": "第二章",
      "title": "把它做成一个项目"
    },
    "chapter-3": {
      "label": "第三章",
      "title": "请介绍一下你的项目"
    },
    "chapter-4": {
      "label": "第四章",
      "title": "没有下一版"
    }
  },
  "passageOrder": [
    "PROLOGUE_S01",
    "PROLOGUE_S02",
    "PROLOGUE_DRAFT_01",
    "PROLOGUE_DRAFT_02",
    "PROLOGUE_DRAFT_03",
    "PROLOGUE_DRAFT_04",
    "PROLOGUE_S03",
    "CH01_CARD",
    "CH01_S01",
    "CH01_S02",
    "CH01_S03",
    "CH01_S04",
    "CH01_S05",
    "CH01_S06",
    "CH01_END",
    "CH02_CARD",
    "CH02_S01",
    "CH02_I01",
    "CH02_I02",
    "CH02_I03",
    "CH02_I04",
    "CH02_I05",
    "CH02_S02",
    "CH02_NOTICE",
    "CH02_S03",
    "CH02_S04",
    "CH02_I06",
    "CH02_I06_WRONG_AGENCY",
    "CH02_I06_WRONG_COMMUNION",
    "CH02_I06_C",
    "CH02_I06_COMPLETE",
    "CH02_S05",
    "CH02_END",
    "CH03_CARD",
    "CH03_S01",
    "CH03_S02",
    "CH03_S03",
    "CH03_S04",
    "CH03_S05",
    "CH03_S06",
    "CH03_S07",
    "CH03_S08",
    "CH03_END",
    "CH04_CARD",
    "CH04_S01",
    "CH04_S02",
    "CH04_END"
  ],
  "endingIds": [
    "CH04_END"
  ],
  "passages": {
    "PROLOGUE_S01": {
      "id": "PROLOGUE_S01",
      "section": "prologue",
      "layer": "reality",
      "kind": "narration",
      "speaker": "旁白",
      "scene": "scene-city",
      "tags": [
        "prologue",
        "layer-reality",
        "scene-city",
        "narration"
      ],
      "paragraphs": [
        "毕业后的第十一天，卡夫卡拖着两个行李箱来到一座陌生的城市。",
        "手机地图把那条路画得很清楚。真正走在路上时，他还是绕了两次。"
      ],
      "choices": [
        {
          "label": "继续",
          "target": "PROLOGUE_S02"
        }
      ]
    },
    "PROLOGUE_S02": {
      "id": "PROLOGUE_S02",
      "section": "prologue",
      "layer": "reality",
      "kind": "thought",
      "speaker": "卡夫卡",
      "scene": "scene-rental",
      "tags": [
        "prologue",
        "layer-reality",
        "scene-rental",
        "thought",
        "speaker-kafka"
      ],
      "paragraphs": [
        "出租屋比照片里窄一些。",
        "一张床，一张桌子，一扇朝向隔壁楼的窗。行李箱摊开以后，房间里便只剩下一条勉强可以落脚的路。",
        "至少它离地铁不远。至少这座城市里有很多游戏公司。"
      ],
      "choices": [
        {
          "label": "查看故事开始前留下的设计稿",
          "target": "PROLOGUE_DRAFT_01"
        }
      ]
    },
    "PROLOGUE_DRAFT_01": {
      "id": "PROLOGUE_DRAFT_01",
      "section": "prologue",
      "layer": "design",
      "kind": "narration",
      "speaker": "旁白",
      "scene": "scene-draft",
      "tags": [
        "prologue",
        "layer-design",
        "scene-draft",
        "narration"
      ],
      "paragraphs": [
        "《伊萨卡手记》设计稿",
        "页面：伊萨卡小屋／入口草案",
        "这不是卡夫卡租住的房间。它是一座画在项目里的小屋——一份后来被反复打开、修改，又被搁置的设计。"
      ],
      "choices": [
        {
          "label": "展开入口草案",
          "target": "PROLOGUE_DRAFT_02"
        }
      ]
    },
    "PROLOGUE_DRAFT_02": {
      "id": "PROLOGUE_DRAFT_02",
      "section": "prologue",
      "layer": "design",
      "kind": "thought",
      "speaker": "卡夫卡",
      "scene": "scene-draft-corridor",
      "tags": [
        "prologue",
        "layer-design",
        "scene-draft-corridor",
        "thought",
        "speaker-kafka"
      ],
      "paragraphs": [
        "【设计稿：走廊】",
        "“呼，终于到了。这里就是伊萨卡小屋吧？”",
        "“伊萨卡……为什么要叫这个名字？”",
        "这两句台词还留在最早的版本里。下面画着一扇门，以及墙边一个尺寸还没有确定的信箱。"
      ],
      "choices": [
        {
          "label": "查看信箱和门",
          "target": "PROLOGUE_DRAFT_03"
        }
      ]
    },
    "PROLOGUE_DRAFT_03": {
      "id": "PROLOGUE_DRAFT_03",
      "section": "prologue",
      "layer": "design",
      "kind": "narration",
      "speaker": "旁白",
      "scene": "scene-draft-corridor",
      "tags": [
        "prologue",
        "layer-design",
        "scene-draft-corridor",
        "narration"
      ],
      "paragraphs": [
        "【设计稿：门与信箱】",
        "信箱通向书信，门通向房间。",
        "在这张草稿里，它们只是两个可以点击的方框。没有来信，也没有关于现实住所的说明。"
      ],
      "choices": [
        {
          "label": "进入设计稿中的房间",
          "target": "PROLOGUE_DRAFT_04"
        }
      ]
    },
    "PROLOGUE_DRAFT_04": {
      "id": "PROLOGUE_DRAFT_04",
      "section": "prologue",
      "layer": "design",
      "kind": "narration",
      "speaker": "旁白",
      "scene": "scene-draft-room",
      "tags": [
        "prologue",
        "layer-design",
        "scene-draft-room",
        "narration"
      ],
      "paragraphs": [
        "【设计稿：伊萨卡小屋】",
        "书桌、主题板、书架。",
        "家具被简单的线条圈在各自的位置上。每个物件旁边都留着空白，像是在等待一种尚未写完的用途。"
      ],
      "choices": [
        {
          "label": "合上设计稿，回到现实",
          "target": "PROLOGUE_S03"
        }
      ]
    },
    "PROLOGUE_S03": {
      "id": "PROLOGUE_S03",
      "section": "prologue",
      "layer": "reality",
      "kind": "thought",
      "speaker": "卡夫卡",
      "scene": "scene-rental",
      "tags": [
        "prologue",
        "layer-reality",
        "scene-rental",
        "thought",
        "speaker-kafka"
      ],
      "paragraphs": [
        "现实里，卡夫卡坐在出租屋唯一的一张桌子前，刷新了招聘页面。",
        "旺逸公司／游戏相关岗位／申请状态：已投递。",
        "他想在游戏行业找到一份工作。现在能做的，似乎只有继续等待。"
      ],
      "choices": [
        {
          "label": "进入第一章",
          "target": "CH01_CARD"
        }
      ]
    },
    "CH01_CARD": {
      "id": "CH01_CARD",
      "section": "chapter-1",
      "layer": "reality",
      "kind": "chapter-card",
      "speaker": "旁白",
      "scene": "scene-unspecified",
      "tags": [
        "chapter-1",
        "layer-reality",
        "chapter-card",
        "narration"
      ],
      "paragraphs": [
        "第一章",
        "等待回复"
      ],
      "choices": [
        {
          "label": "开始",
          "target": "CH01_S01"
        }
      ]
    },
    "CH01_S01": {
      "id": "CH01_S01",
      "section": "chapter-1",
      "layer": "reality",
      "kind": "thought",
      "speaker": "卡夫卡",
      "scene": "scene-rental",
      "tags": [
        "chapter-1",
        "layer-reality",
        "scene-rental",
        "thought",
        "speaker-kafka"
      ],
      "paragraphs": [
        "第三次刷新邮箱以后，页面仍然没有变化。",
        "卡夫卡把招聘网站最小化，又重新打开。仿佛只要动作做得足够频繁，某封尚未寄出的邮件就会提前抵达。"
      ],
      "choices": [
        {
          "label": "检查已经提交的简历",
          "target": "CH01_S02"
        }
      ]
    },
    "CH01_S02": {
      "id": "CH01_S02",
      "section": "chapter-1",
      "layer": "reality",
      "kind": "thought",
      "speaker": "卡夫卡",
      "scene": "scene-resume",
      "tags": [
        "chapter-1",
        "layer-reality",
        "scene-resume",
        "thought",
        "speaker-kafka"
      ],
      "paragraphs": [
        "教育经历、软件技能、课程作业。",
        "“项目经历”下面只有几行很轻的文字。它们都是真的，但没有一行像是能够在面试里讲很久的东西。",
        "如果旺逸真的发来通知，我要拿什么证明自己可以做游戏？"
      ],
      "choices": [
        {
          "label": "查看旧项目文件夹",
          "target": "CH01_S03"
        }
      ]
    },
    "CH01_S03": {
      "id": "CH01_S03",
      "section": "chapter-1",
      "layer": "reality",
      "kind": "thought",
      "speaker": "卡夫卡",
      "scene": "scene-desktop",
      "tags": [
        "chapter-1",
        "layer-reality",
        "scene-desktop",
        "thought",
        "speaker-kafka"
      ],
      "paragraphs": [
        "旧文件夹里有一个很久没有打开的项目：ITHACA_JOURNAL。",
        "最后修改时间停在毕业以前。README 写得比程序完整，截图又比 README 看起来完整。",
        "卡夫卡盯着那个名字看了一会儿。至少，它是自己从空白开始做出来的。"
      ],
      "choices": [
        {
          "label": "重新打开《伊萨卡手记》",
          "target": "CH01_S04"
        }
      ]
    },
    "CH01_S04": {
      "id": "CH01_S04",
      "section": "chapter-1",
      "layer": "design",
      "kind": "thought",
      "speaker": "卡夫卡",
      "scene": "scene-draft",
      "tags": [
        "chapter-1",
        "layer-design",
        "scene-draft",
        "thought",
        "speaker-kafka"
      ],
      "paragraphs": [
        "项目重新运行时，序章里见过的走廊再次出现在屏幕上。",
        "这一次不是故事提前展示的画面，而是卡夫卡真的重新打开了那份旧设计稿。",
        "他已经快忘记，自己为什么会先画一间小屋。"
      ],
      "choices": [
        {
          "label": "回想最初的文件",
          "target": "CH01_S05"
        }
      ]
    },
    "CH01_S05": {
      "id": "CH01_S05",
      "section": "chapter-1",
      "layer": "reality",
      "kind": "narration",
      "speaker": "旁白",
      "scene": "scene-memory",
      "tags": [
        "chapter-1",
        "layer-reality",
        "scene-memory",
        "narration"
      ],
      "paragraphs": [
        "大学最后一段时间，他的电脑桌面上散着几种互不相干的东西：没有写完的日记、聊天记录的截图、一封没有寄出的邮件，以及课程结束以后再也不会打开的文档。",
        "他试着把它们整理成一篇完整的毕业总结。每整理一次，就要删掉一些无法放进主线里的内容。",
        "后来他停了下来。"
      ],
      "choices": [
        {
          "label": "继续回忆",
          "target": "CH01_S06"
        }
      ]
    },
    "CH01_S06": {
      "id": "CH01_S06",
      "section": "chapter-1",
      "layer": "reality",
      "kind": "thought",
      "speaker": "卡夫卡",
      "scene": "scene-memory",
      "tags": [
        "chapter-1",
        "layer-reality",
        "scene-memory",
        "thought",
        "speaker-kafka"
      ],
      "paragraphs": [
        "也许它们不需要立刻成为一篇文章。",
        "也许可以先有一个地方，让不同的东西留在不同的位置：日记放在书桌，零散的片段贴在板上，信放进信箱，暂时整理好的内容再进入书架。",
        "那不是现实中可以搬进去的房子，只是一种让界面变得容易想象的方法。"
      ],
      "choices": [
        {
          "label": "看看最初的小屋草图",
          "target": "CH01_END"
        }
      ]
    },
    "CH01_END": {
      "id": "CH01_END",
      "section": "chapter-1",
      "layer": "design",
      "kind": "thought",
      "speaker": "卡夫卡",
      "scene": "scene-draft-room",
      "tags": [
        "chapter-1",
        "layer-design",
        "scene-draft-room",
        "thought",
        "speaker-kafka"
      ],
      "paragraphs": [
        "当时，卡夫卡给它起名叫《伊萨卡手记》。",
        "现在，他需要把这张旧草图整理成一份能够写进简历、也能够在面试中打开的项目。"
      ],
      "choices": [
        {
          "label": "进入第二章",
          "target": "CH02_CARD"
        }
      ]
    },
    "CH02_CARD": {
      "id": "CH02_CARD",
      "section": "chapter-2",
      "layer": "design",
      "kind": "chapter-card",
      "speaker": "旁白",
      "scene": "scene-unspecified",
      "tags": [
        "chapter-2",
        "layer-design",
        "chapter-card",
        "narration"
      ],
      "paragraphs": [
        "第二章",
        "把它做成一个项目"
      ],
      "choices": [
        {
          "label": "开始",
          "target": "CH02_S01"
        }
      ]
    },
    "CH02_S01": {
      "id": "CH02_S01",
      "section": "chapter-2",
      "layer": "design",
      "kind": "thought",
      "speaker": "卡夫卡",
      "scene": "scene-draft-room",
      "tags": [
        "chapter-2",
        "layer-design",
        "scene-draft-room",
        "thought",
        "speaker-kafka"
      ],
      "paragraphs": [
        "旧版本已经有了一间房，也有了几个可以点击的物件。",
        "问题是，每个物件都只完成到“好像应该有这个功能”。",
        "卡夫卡从书桌开始，一页一页查看以前留下的设计。"
      ],
      "choices": [
        {
          "label": "展开日记页面",
          "target": "CH02_I01"
        }
      ]
    },
    "CH02_I01": {
      "id": "CH02_I01",
      "section": "chapter-2",
      "layer": "design",
      "kind": "interaction",
      "speaker": "旁白",
      "scene": "scene-draft-desk",
      "tags": [
        "chapter-2",
        "layer-design",
        "scene-draft-desk",
        "narration",
        "interaction-journal"
      ],
      "paragraphs": [
        "【设计稿：日记】",
        "按日期留下每天发生的事情。句子不需要解释一生，只需要先把今天写完。",
        "旧稿里只有一张空白纸和一个“保存”按钮。"
      ],
      "choices": [
        {
          "label": "查看没有写成日记的内容",
          "target": "CH02_I02"
        }
      ]
    },
    "CH02_I02": {
      "id": "CH02_I02",
      "section": "chapter-2",
      "layer": "design",
      "kind": "interaction",
      "speaker": "旁白",
      "scene": "scene-draft-desk",
      "tags": [
        "chapter-2",
        "layer-design",
        "scene-draft-desk",
        "narration",
        "interaction-fragments"
      ],
      "paragraphs": [
        "【设计稿：碎片】",
        "有些内容短得只剩半句话，有些内容连日期都记不清。它们不适合被强行补成日记，却也不应该因为不完整而消失。",
        "卡夫卡把它们叫作“碎片”。"
      ],
      "choices": [
        {
          "label": "把碎片放到主题板上",
          "target": "CH02_I03"
        }
      ]
    },
    "CH02_I03": {
      "id": "CH02_I03",
      "section": "chapter-2",
      "layer": "design",
      "kind": "interaction",
      "speaker": "旁白",
      "scene": "scene-draft-board",
      "tags": [
        "chapter-2",
        "layer-design",
        "scene-draft-board",
        "narration",
        "interaction-theme"
      ],
      "paragraphs": [
        "【设计稿：主题板】",
        "几张碎片被拖到同一块板上。它们可以暂时靠近，也可以随时再被取下。",
        "主题并不证明它们天生属于一起。它只记录卡夫卡此刻看见的联系。"
      ],
      "choices": [
        {
          "label": "查看主题怎样进入书架",
          "target": "CH02_I04"
        }
      ]
    },
    "CH02_I04": {
      "id": "CH02_I04",
      "section": "chapter-2",
      "layer": "design",
      "kind": "interaction",
      "speaker": "旁白",
      "scene": "scene-draft-bookshelf",
      "tags": [
        "chapter-2",
        "layer-design",
        "scene-draft-bookshelf",
        "narration",
        "interaction-book"
      ],
      "paragraphs": [
        "【设计稿：书籍】",
        "当一组材料已经足够接近，系统可以把它们保存成一个不再变化的版本。",
        "卡夫卡把这种快照叫作“书”。它不是结论，只是一段时间曾经被整理成什么样子。"
      ],
      "choices": [
        {
          "label": "展开信箱设计",
          "target": "CH02_I05"
        }
      ]
    },
    "CH02_I05": {
      "id": "CH02_I05",
      "section": "chapter-2",
      "layer": "design",
      "kind": "interaction",
      "speaker": "旁白",
      "scene": "scene-draft-mailbox",
      "tags": [
        "chapter-2",
        "layer-design",
        "scene-draft-mailbox",
        "narration",
        "interaction-letter"
      ],
      "paragraphs": [
        "【设计稿：书信】",
        "有些文字从一开始就是写给某个人的。即使没有真的寄出，称呼、停顿和没有说完的话也来自一段关系。",
        "信箱保存这些来信与寄件，不把它们改写成普通日记。"
      ],
      "choices": [
        {
          "label": "查看现在的完整项目",
          "target": "CH02_S02"
        }
      ]
    },
    "CH02_S02": {
      "id": "CH02_S02",
      "section": "chapter-2",
      "layer": "design",
      "kind": "thought",
      "speaker": "卡夫卡",
      "scene": "scene-draft-overview",
      "tags": [
        "chapter-2",
        "layer-design",
        "scene-draft-overview",
        "thought",
        "speaker-kafka"
      ],
      "paragraphs": [
        "日记、碎片、主题、书籍、书信。",
        "放在同一个房间里，它们看起来已经像一套完整的功能。",
        "可是如果面试官问：“玩家进入以后，具体会经历什么？”",
        "卡夫卡仍然只能逐个介绍按钮。"
      ],
      "choices": [
        {
          "label": "继续",
          "target": "CH02_NOTICE"
        }
      ]
    },
    "CH02_NOTICE": {
      "id": "CH02_NOTICE",
      "section": "chapter-2",
      "layer": "reality",
      "kind": "narration",
      "speaker": "旁白",
      "scene": "scene-notification",
      "tags": [
        "chapter-2",
        "layer-reality",
        "scene-notification",
        "narration"
      ],
      "paragraphs": [
        "屏幕右下角弹出一封新邮件。",
        "旺逸公司邀请卡夫卡参加面试。时间是后天下午。",
        "设计稿退到窗口后面，现实突然只剩下两天。"
      ],
      "choices": [
        {
          "label": "打开面试通知",
          "target": "CH02_S03"
        }
      ]
    },
    "CH02_S03": {
      "id": "CH02_S03",
      "section": "chapter-2",
      "layer": "reality",
      "kind": "thought",
      "speaker": "卡夫卡",
      "scene": "scene-rental",
      "tags": [
        "chapter-2",
        "layer-reality",
        "scene-rental",
        "thought",
        "speaker-kafka"
      ],
      "paragraphs": [
        "卡夫卡把通知从头到尾读了三遍，又重新打开项目。",
        "只展示一组工具，大概还不够像一段游戏经历。",
        "他需要一个更具体的入口，一条玩家能够真正走进去的路线。"
      ],
      "choices": [
        {
          "label": "新建“特定主题旅程”设计页",
          "target": "CH02_S04"
        }
      ]
    },
    "CH02_S04": {
      "id": "CH02_S04",
      "section": "chapter-2",
      "layer": "design",
      "kind": "thought",
      "speaker": "卡夫卡",
      "scene": "scene-route-board",
      "tags": [
        "chapter-2",
        "layer-design",
        "scene-route-board",
        "thought",
        "speaker-kafka"
      ],
      "paragraphs": [
        "卡夫卡先写下两个容易理解的方向。",
        "A：我有一个想要实现的目标。",
        "B：我有一个在意的人。",
        "他在阅读材料里找到两个可以暂时对应的词：agency 与 communion。"
      ],
      "choices": [
        {
          "label": "整理 A/B 的对应关系",
          "target": "CH02_I06"
        }
      ]
    },
    "CH02_I06": {
      "id": "CH02_I06",
      "section": "chapter-2",
      "layer": "design",
      "kind": "interaction",
      "speaker": "",
      "scene": "scene-route-board",
      "tags": [
        "chapter-2",
        "layer-design",
        "scene-route-board",
        "interaction-route-theme-match"
      ],
      "paragraphs": [
        "A. 我有一个想要实现的目标……　[　　]",
        "B. 我有一个在意的人……　　　　[　　]",
        "C. 我……",
        "可用标签：agency／communion"
      ],
      "choices": [
        {
          "label": "把 agency 放到 B 后面",
          "target": "CH02_I06_WRONG_AGENCY"
        },
        {
          "label": "把 communion 放到 A 后面",
          "target": "CH02_I06_WRONG_COMMUNION"
        },
        {
          "label": "点击还没有完成的 C",
          "target": "CH02_I06_C"
        },
        {
          "label": "把 agency 放到 A、communion 放到 B",
          "target": "CH02_I06_COMPLETE"
        }
      ]
    },
    "CH02_I06_WRONG_AGENCY": {
      "id": "CH02_I06_WRONG_AGENCY",
      "section": "chapter-2",
      "layer": "design",
      "kind": "thought",
      "speaker": "卡夫卡",
      "scene": "scene-route-board",
      "tags": [
        "chapter-2",
        "layer-design",
        "scene-route-board",
        "feedback",
        "thought",
        "speaker-kafka"
      ],
      "paragraphs": [
        "不对。agency 更接近行动、影响、掌控和实现目标的方向。",
        "如果把它放在 B 后面，我明天大概连自己都解释不清。"
      ],
      "choices": [
        {
          "label": "重新排列",
          "target": "CH02_I06"
        }
      ]
    },
    "CH02_I06_WRONG_COMMUNION": {
      "id": "CH02_I06_WRONG_COMMUNION",
      "section": "chapter-2",
      "layer": "design",
      "kind": "thought",
      "speaker": "卡夫卡",
      "scene": "scene-route-board",
      "tags": [
        "chapter-2",
        "layer-design",
        "scene-route-board",
        "feedback",
        "thought",
        "speaker-kafka"
      ],
      "paragraphs": [
        "不对。communion 更接近关系、照料、归属和共同生活。",
        "先不要为了填满格子而交换它们。"
      ],
      "choices": [
        {
          "label": "重新排列",
          "target": "CH02_I06"
        }
      ]
    },
    "CH02_I06_C": {
      "id": "CH02_I06_C",
      "section": "chapter-2",
      "layer": "design",
      "kind": "thought",
      "speaker": "卡夫卡",
      "scene": "scene-route-board",
      "tags": [
        "chapter-2",
        "layer-design",
        "scene-route-board",
        "feedback",
        "thought",
        "speaker-kafka"
      ],
      "paragraphs": [
        "C 后面仍然只有“我……”。",
        "卡夫卡还没有想好它会通向什么。面试在后天，他先把这个入口留在当前版本里。"
      ],
      "choices": [
        {
          "label": "回到 A/B 设计",
          "target": "CH02_I06"
        }
      ]
    },
    "CH02_I06_COMPLETE": {
      "id": "CH02_I06_COMPLETE",
      "section": "chapter-2",
      "layer": "design",
      "kind": "thought",
      "speaker": "卡夫卡",
      "scene": "scene-route-board",
      "tags": [
        "chapter-2",
        "layer-design",
        "scene-route-board",
        "feedback",
        "thought",
        "speaker-kafka"
      ],
      "paragraphs": [
        "A 对应 agency，B 对应 communion。",
        "至少在演示里，这两个入口已经可以被说明。C 仍然没有完成，但卡夫卡没有再改。"
      ],
      "choices": [
        {
          "label": "保存当前演示版本",
          "target": "CH02_S05"
        }
      ]
    },
    "CH02_S05": {
      "id": "CH02_S05",
      "section": "chapter-2",
      "layer": "design",
      "kind": "narration",
      "speaker": "旁白",
      "scene": "scene-route-board",
      "tags": [
        "chapter-2",
        "layer-design",
        "scene-route-board",
        "narration"
      ],
      "paragraphs": [
        "版本说明：特定主题旅程／A-B-C 入口草案。",
        "卡夫卡截了几张图，把项目地址和介绍顺序写进面试笔记。这个版本并不完整，但已经比一组散开的工具更像一个可以讲述的项目。"
      ],
      "choices": [
        {
          "label": "等待面试开始",
          "target": "CH02_END"
        }
      ]
    },
    "CH02_END": {
      "id": "CH02_END",
      "section": "chapter-2",
      "layer": "reality",
      "kind": "thought",
      "speaker": "卡夫卡",
      "scene": "scene-rental",
      "tags": [
        "chapter-2",
        "layer-reality",
        "scene-rental",
        "thought",
        "speaker-kafka"
      ],
      "paragraphs": [
        "面试前一晚，项目页面停在 A/B/C。",
        "卡夫卡把会议链接、简历和演示页面依次排在浏览器标签栏里，然后关掉了房间的灯。"
      ],
      "choices": [
        {
          "label": "进入第三章",
          "target": "CH03_CARD"
        }
      ]
    },
    "CH03_CARD": {
      "id": "CH03_CARD",
      "section": "chapter-3",
      "layer": "reality",
      "kind": "chapter-card",
      "speaker": "旁白",
      "scene": "scene-unspecified",
      "tags": [
        "chapter-3",
        "layer-reality",
        "chapter-card",
        "narration"
      ],
      "paragraphs": [
        "第三章",
        "请介绍一下你的项目"
      ],
      "choices": [
        {
          "label": "开始",
          "target": "CH03_S01"
        }
      ]
    },
    "CH03_S01": {
      "id": "CH03_S01",
      "section": "chapter-3",
      "layer": "reality",
      "kind": "thought",
      "speaker": "卡夫卡",
      "scene": "scene-interview",
      "tags": [
        "chapter-3",
        "layer-reality",
        "scene-interview",
        "thought",
        "speaker-kafka"
      ],
      "paragraphs": [
        "卡夫卡提前十五分钟进入会议。",
        "摄像头里的出租屋只露出一面空墙。共享屏幕的按钮在下方亮着，他又确认了一次《伊萨卡手记》能够打开。"
      ],
      "choices": [
        {
          "label": "面试开始",
          "target": "CH03_S02"
        }
      ]
    },
    "CH03_S02": {
      "id": "CH03_S02",
      "section": "chapter-3",
      "layer": "reality",
      "kind": "dialogue",
      "speaker": "面试官",
      "scene": "scene-interview",
      "tags": [
        "chapter-3",
        "layer-reality",
        "scene-interview",
        "dialogue",
        "speaker-interviewer"
      ],
      "paragraphs": [
        "“先介绍一下你做过的项目吧。”",
        "“有正式上线的项目吗？你参与的部分是什么？大概做到了多少流水？”"
      ],
      "choices": [
        {
          "label": "回答",
          "target": "CH03_S03"
        }
      ]
    },
    "CH03_S03": {
      "id": "CH03_S03",
      "section": "chapter-3",
      "layer": "reality",
      "kind": "dialogue",
      "speaker": "卡夫卡",
      "scene": "scene-interview",
      "tags": [
        "chapter-3",
        "layer-reality",
        "scene-interview",
        "dialogue",
        "speaker-kafka"
      ],
      "paragraphs": [
        "“我还没有参与过正式上线的商业项目。”",
        "卡夫卡停了一下。",
        "“不过我自己做过一个项目，叫《伊萨卡手记》。如果方便的话，我可以共享屏幕。”"
      ],
      "choices": [
        {
          "label": "共享项目页面",
          "target": "CH03_S04"
        }
      ]
    },
    "CH03_S04": {
      "id": "CH03_S04",
      "section": "chapter-3",
      "layer": "design",
      "kind": "dialogue",
      "speaker": "卡夫卡",
      "scene": "scene-screen-share",
      "tags": [
        "chapter-3",
        "layer-design",
        "scene-screen-share",
        "dialogue",
        "speaker-kafka"
      ],
      "paragraphs": [
        "屏幕共享开始。",
        "卡夫卡从伊萨卡小屋讲起，依次打开书桌、主题板、信箱和书架，又翻到这两天刚整理好的特定主题旅程。",
        "最后，页面停在 A/B/C。"
      ],
      "choices": [
        {
          "label": "等待面试官回应",
          "target": "CH03_S05"
        }
      ]
    },
    "CH03_S05": {
      "id": "CH03_S05",
      "section": "chapter-3",
      "layer": "reality",
      "kind": "dialogue",
      "speaker": "面试官",
      "scene": "scene-interview",
      "tags": [
        "chapter-3",
        "layer-reality",
        "scene-interview",
        "dialogue",
        "speaker-interviewer"
      ],
      "paragraphs": [
        "“这个形式挺少见的。”",
        "面试官向前靠了一点，又看了一遍主题板和信箱。",
        "“把写作工具做成一个空间，这个想法有点意思。”"
      ],
      "choices": [
        {
          "label": "继续",
          "target": "CH03_S06"
        }
      ]
    },
    "CH03_S06": {
      "id": "CH03_S06",
      "section": "chapter-3",
      "layer": "reality",
      "kind": "dialogue",
      "speaker": "面试官",
      "scene": "scene-interview",
      "tags": [
        "chapter-3",
        "layer-reality",
        "scene-interview",
        "dialogue",
        "speaker-interviewer"
      ],
      "paragraphs": [
        "“现在已经上线了吗？”",
        "“有多少用户？留存或者付费的数据呢？”",
        "“你刚才说没有商业项目，所以这个也还没有流水，对吗？”"
      ],
      "choices": [
        {
          "label": "回答",
          "target": "CH03_S07"
        }
      ]
    },
    "CH03_S07": {
      "id": "CH03_S07",
      "section": "chapter-3",
      "layer": "reality",
      "kind": "dialogue",
      "speaker": "卡夫卡",
      "scene": "scene-interview",
      "tags": [
        "chapter-3",
        "layer-reality",
        "scene-interview",
        "dialogue",
        "speaker-kafka"
      ],
      "paragraphs": [
        "“还没有。”",
        "“目前主要是我自己在开发和测试。完整的旅程也是最近才开始补的。”",
        "卡夫卡原本准备了很长的项目介绍。到了这里，剩下的话忽然都像是在重复屏幕上已经看见的功能。"
      ],
      "choices": [
        {
          "label": "继续",
          "target": "CH03_S08"
        }
      ]
    },
    "CH03_S08": {
      "id": "CH03_S08",
      "section": "chapter-3",
      "layer": "reality",
      "kind": "narration",
      "speaker": "旁白",
      "scene": "scene-interview",
      "tags": [
        "chapter-3",
        "layer-reality",
        "scene-interview",
        "narration"
      ],
      "paragraphs": [
        "面试官停了两秒，很轻地摇了摇头，在表格里记了一行字。",
        "“明白了，目前还是个人原型。”",
        "他没有继续评价，只是把话题移到下一项。"
      ],
      "choices": [
        {
          "label": "结束面试",
          "target": "CH03_END"
        }
      ]
    },
    "CH03_END": {
      "id": "CH03_END",
      "section": "chapter-3",
      "layer": "reality",
      "kind": "thought",
      "speaker": "卡夫卡",
      "scene": "scene-interview",
      "tags": [
        "chapter-3",
        "layer-reality",
        "scene-interview",
        "thought",
        "speaker-kafka"
      ],
      "paragraphs": [
        "会议按预定时间结束。",
        "“后续结果会由招聘同事通知。”",
        "窗口关闭以后，卡夫卡才发现自己一直把手放在鼠标上，却已经很久没有动过。"
      ],
      "choices": [
        {
          "label": "进入第四章",
          "target": "CH04_CARD"
        }
      ]
    },
    "CH04_CARD": {
      "id": "CH04_CARD",
      "section": "chapter-4",
      "layer": "reality",
      "kind": "chapter-card",
      "speaker": "旁白",
      "scene": "scene-unspecified",
      "tags": [
        "chapter-4",
        "layer-reality",
        "chapter-card",
        "narration"
      ],
      "paragraphs": [
        "第四章",
        "没有下一版"
      ],
      "choices": [
        {
          "label": "继续",
          "target": "CH04_S01"
        }
      ]
    },
    "CH04_S01": {
      "id": "CH04_S01",
      "section": "chapter-4",
      "layer": "design",
      "kind": "narration",
      "speaker": "旁白",
      "scene": "scene-route-board",
      "tags": [
        "chapter-4",
        "layer-design",
        "scene-route-board",
        "narration"
      ],
      "paragraphs": [
        "会议窗口消失，刚才共享的项目重新占满屏幕。",
        "A. 我有一个想要实现的目标……",
        "B. 我有一个在意的人……",
        "C. 我……",
        "页面仍然停在面试时展示的版本。"
      ],
      "choices": [
        {
          "label": "继续",
          "target": "CH04_S02"
        }
      ]
    },
    "CH04_S02": {
      "id": "CH04_S02",
      "section": "chapter-4",
      "layer": "reality",
      "kind": "narration",
      "speaker": "旁白",
      "scene": "scene-desktop",
      "tags": [
        "chapter-4",
        "layer-reality",
        "scene-desktop",
        "narration"
      ],
      "paragraphs": [
        "后来，卡夫卡没有等到旺逸的下一轮通知。",
        "他原本以为，等找到工作，等想清楚这个项目究竟应该是什么，自己还会继续做下去。",
        "这个页面却没有等到下一个版本。"
      ],
      "choices": [
        {
          "label": "最后",
          "target": "CH04_END"
        }
      ]
    },
    "CH04_END": {
      "id": "CH04_END",
      "section": "chapter-4",
      "layer": "reality",
      "kind": "ending",
      "speaker": "旁白",
      "scene": "scene-desktop",
      "tags": [
        "chapter-4",
        "layer-reality",
        "scene-desktop",
        "narration",
        "ending"
      ],
      "paragraphs": [
        "没有更多的章节，没有真正的用户，也没有流水。",
        "像绝大多数由一时热情开始的个人项目一样，它没有经历一场正式的失败。没有人宣布它已经结束。",
        "它只是再也没有被打开。",
        "《伊萨卡手记》就这样无疾而终了。"
      ],
      "choices": []
    }
  }
});

export function getJourneyPassage(passageId) {
  return journeyStory.passages[passageId] ?? journeyStory.passages[journeyStory.start];
}
