export const SUPPORTED_LOCALES = Object.freeze([
  Object.freeze({ id: "zh-CN", label: "简体中文", nativeLabel: "简体中文" }),
  Object.freeze({ id: "en", label: "英语", nativeLabel: "English" }),
]);

const STORAGE_KEY = "ithaca-journal:locale:v1";

const ENGLISH = Object.freeze({
  "伊萨卡手记｜0.4.0 开发版": "Ithaca Journal | 0.4.0 Preview",
  "《伊萨卡手记》0.4.0：以纸页为基本单元，在书桌、公告板、信箱与书架之间继续书写。": "Ithaca Journal 0.4.0: keep writing across the desk, board, mailbox, and bookshelf, one page at a time.",
  "伊萨卡手记介绍": "About Ithaca Journal",
  "给尚未抵达的地方，": "For the places still ahead,",
  "留下一页手记。": "leave a page behind.",
  "这是《伊萨卡手记》的小范围云端测试。它保存书写，也保存一次设计如何被使用、被质疑、再被改变的过程。": "This is a limited cloud preview of Ithaca Journal. It preserves both your writing and the story of a design being used, questioned, and changed.",
  "01 / 进入书房": "01 / Enter the study",
  "正在确认访问身份": "Checking access",
  "本地开发将使用隔离的开发身份；线上测试由 Cloudflare Access 验证受邀邮箱。": "Local development uses an isolated test identity; the online preview verifies invited email addresses through Cloudflare Access.",
  "重新检查身份": "Check again",
  "重新登录": "Sign in again",
  "重新体验 0.4.0": "Replay 0.4.0",
  "重置本地数据": "Reset local data",
  "重置测试": "Reset test data",
  "本地验收工具": "Local review tools",
  "清除本地测试数据？": "Clear local test data?",
  "这会清除当前本地开发身份的视觉小说进度、工具数据和里程碑，然后回到一份全新的本地存档。它不会影响 staging、production 或 Cloudflare Access 允许名单。": "This clears the current local development identity's visual-novel progress, tool data, and milestones, then returns to a fresh local archive. It does not affect staging, production, or the Cloudflare Access allowlist.",
  "这将删除当前应用账户、视觉小说进度、全部纸页（含日记）、主题、寄件、成书和里程碑，但不会修改 Cloudflare Access 的邮箱允许名单。再次登录会建立一个空账户。该操作无法撤销。": "This permanently deletes the current app account, visual-novel progress, every page (including journal entries), themes, sent letters, finished books, and milestones. It does not change the Cloudflare Access allowlist. Signing in again creates an empty account. This cannot be undone.",
  "重新体验完整流程？": "Replay the full journey?",
  "这会清除当前本地开发身份的旅程、来信阅读状态、全部纸页（含日记）、主题、寄件、成书和里程碑，然后自动回到“开始旅程”。它不会影响 staging、production 或 Cloudflare Access 允许名单。": "This clears the current local development identity's journey, letter-reading state, all pages (including journal entries), themes, sent letters, finished books, and milestones, then returns to “Begin journey.” It does not affect staging, production, or the Cloudflare Access allowlist.",
  "以重新开始": "to start again",
  "清除并重新开始": "Clear and start again",
  "阅读既有研究": "Read the research",
  "查看冻结原型": "View the archived prototype",
  "伊萨卡手记": "Ithaca Journal",
  "在生活的碎片中，写下可以返回的地方。": "Among life's fragments, write down a place you can return to.",
  "开始旅程": "Start journey",
  "继续旅程": "Continue journey",
  "重访旅程": "Revisit journey",
  "视觉小说": "Visual novel",
  "写作工具": "Writing tools",
  "一则故事": "A story",
  "进入故事  →": "Enter story  →",
  "打开工具  →": "Open tools  →",
  "进入书桌、主题板、信箱与书架": "Enter the desk, theme board, mailbox, and bookshelf",
  "回到房间": "Return to the room",
  "从抵达陌生城市的这一天开始": "Begin on the day you arrive in an unfamiliar city",
  "二十一天之后，书写仍在继续": "After twenty-one days, the writing continues",
  "设置": "Settings",
  "语言与阅读偏好": "Language and reading preferences",
  "小彩蛋": "Little surprises",
  "查看旅途中悄悄亮起的里程碑": "See the milestones that quietly lit up along the way",
  "查看使用中悄悄亮起的里程碑": "See the milestones that quietly light up as you use the tools",
  "小范围云端测试 · 0.4.0": "Limited cloud preview · 0.4.0",
  "删除数据": "Delete data",
  "退出": "Sign out",
  "语言设置": "Language settings",
  "界面语言": "Interface language",
  "选择应用用于导航、按钮和状态提示的语言。": "Choose the language used for navigation, controls, and status messages.",
  "简体中文": "Simplified Chinese",
  "英语": "English",
  "语言包按独立字典组织，后续可以继续加入新的语言。": "Language packs use independent dictionaries, so more languages can be added later.",
  "关闭": "Close",
  "旅途里程碑": "Journey milestones",
  "使用里程碑": "Usage milestones",
  "像翻开书页一样，看看哪些时刻已经被旅途记住。": "Open this like a page and see which moments the journey remembers.",
  "像翻开书页一样，看看哪些使用时刻已经被记住。": "Open this like a page and see which moments of use have been remembered.",
  "正在整理里程碑……": "Gathering milestones…",
  "暂时无法读取里程碑。": "Milestones could not be loaded right now.",
  "已解锁": "Unlocked",
  "未解锁": "Locked",
  "抵达": "Arrival",
  "开始第一天的旅程": "Begin the first day of the journey",
  "留下一页": "Leave a page",
  "保存第一张纸页": "Save your first page",
  "写日记": "Keep a journal",
  "写下第一篇日记": "Write your first journal entry",
  "连起碎片": "Connect the fragments",
  "建立第一块主题板": "Create your first theme board",
  "寄出回声": "Send an echo",
  "寄出第一封书信": "Send your first letter",
  "成为作者": "Become an author",
  "装订并上架第一本书": "Bind and shelve your first book",
  "积跬步": "Step by step",
  "纸页正文累计写下 1,000 个字符": "Write 1,000 characters across your pages",
  "这就是伊萨卡手记": "This is Ithaca Journal",
  "完成二十一天的旅程": "Complete the twenty-one-day journey",
  "里程碑已解锁": "Milestone unlocked",
  "场景": "Scene",
  "正在准备场景": "Preparing the scene",
  "选择场景中的物件，继续你的旅程。": "Choose an object in the scene to continue your journey.",
  "选择场景中的物件，打开对应的书写工具。": "Choose an object in the scene to open its writing tool.",
  "返回标题": "Return to title",
  "← 返回标题": "← Return to title",
  "一份还没有完成的设计稿": "An unfinished design draft",
  "我把这份设计稿摊在桌面上。上面只写着一个名字：《伊萨卡手记》。": "I spread the design draft across the desk. It bears only one name: Ithaca Journal.",
  "它最后会成为一组帮助人们整理生活碎片的工具。但它是怎么诞生的？或许，要从我第一次画下这个房间说起。": "It will eventually become a set of tools for gathering the fragments of a life. But how did it come to be? Perhaps the story begins when I first drew this room.",
  "第一章正在书写": "Chapter one is being written",
  "物件": "Object",
  "查看": "Inspect",
  "当前日期与时段": "Current date and time of day",
  "此刻": "Now",
  "白天": "Daytime",
  "夜晚": "Night",
  "早上": "Morning",
  "下午": "Afternoon",
  "黄昏": "Dusk",
  "深夜": "Late night",
  "我": "Me",
  "返回": "Back",
  "返回房间": "Return to room",
  "继续": "Continue",
  "结束": "Finish",
  "开始探索": "Start exploring",
  "布置房间": "Arrange room",
  "可拖动，也可使用方向键调整位置": "Draggable; use the arrow keys to adjust position",
  "完成布置": "Finish arranging",
  "恢复默认": "Restore defaults",
  "拖动物件调整位置；也可以聚焦物件后使用方向键微调，按 Esc 完成。": "Drag objects to reposition them, or focus an object and use the arrow keys. Press Esc when finished.",
  "需要启用 JavaScript 才能探索场景中的物件。": "JavaScript is required to explore objects in the scene.",
  "你的房间": "Your room",
  "现在想从哪里开始？": "Where would you like to begin?",
  "早上想从哪里开始？": "Where would you like to begin this morning?",
  "下午想从哪里开始？": "Where would you like to begin this afternoon?",
  "黄昏想从哪里开始？": "Where would you like to begin at dusk?",
  "深夜想从哪里开始？": "Where would you like to begin tonight?",
  "书桌保存书写，公告板拼接主题，书架收藏成书；房门通向门外的信箱。": "The desk holds your pages, the board connects themes, the shelf keeps finished books, and the door leads to the mailbox.",
  "地毯": "Rug",
  "房门": "Door",
  "走到门外": "Step outside",
  "旧信箱就在门外": "The old mailbox is outside",
  "公告板": "Board",
  "打开公告板": "Open the board",
  "把碎片摆成一个主题": "Arrange fragments into a theme",
  "书架": "Bookshelf",
  "打开书架": "Open the bookshelf",
  "翻看整理过的故事": "Read the stories you have assembled",
  "绿植": "Plant",
  "书桌": "Writing desk",
  "前往书桌": "Go to the desk",
  "纸页还在等你": "Your pages are waiting",
  "台灯": "Desk lamp",
  "打开台灯": "Turn on desk lamp",
  "关掉台灯": "Turn off desk lamp",
  "让暖光落在书桌上": "Cast a warm light across the desk",
  "暖光正亮着，再点一次让房间暗下来": "The warm light is on; activate it again to dim the room",
  "椅子": "Chair",
  "门外": "Outside the door",
  "公寓门外": "Apartment hallway",
  "信件留在门外，推开房门才能回到书写的地方。": "Letters wait outside; open the door to return to your writing place.",
  "进入房间": "Enter the room",
  "推门回到书写的地方": "Open the door and return to your writing",
  "走廊壁灯": "Hallway lamp",
  "打开走廊壁灯": "Turn on hallway lamp",
  "关掉走廊壁灯": "Turn off hallway lamp",
  "照亮门边与信箱": "Light the doorway and mailbox",
  "壁灯正亮着，再点一次让走廊暗下来": "The hallway lamp is on; activate it again to dim the hallway",
  "信箱": "Mailbox",
  "查看信箱": "Check the mailbox",
  "里面似乎多了一封信": "There seems to be a new letter inside",
  "整理写下与寄出的信": "Organize the letters you write and send",
  "这里保存写下并寄出的信，也可以从寄件重新建立草稿。": "This keeps the letters you write and send, and lets you create a new draft from any sent letter.",
  "打开寄件箱": "Open sent letters",
  "信箱在门外，可以在那里整理寄件。": "The mailbox is outside, where sent letters can be organized.",
  "（拖着行李箱的声音）呼……终于到了。": "(A suitcase rolls across the floor.) Whew… I finally made it.",
  "看着手机上的导航，应该就是这里没错了。": "According to the map on my phone, this should be the place.",
  "刚来到这座陌生城市，能找到这个安静的单间，已经很幸运了。": "I have only just arrived in this unfamiliar city. Finding this quiet little room already feels lucky.",
  "总之先住下来吧。": "For now, I should settle in.",
  "晨光落在信箱盖上。里面似乎多了一封信。": "Morning light falls across the mailbox lid. There seems to be a new letter inside.",
  "午后的光落在信箱盖上。里面似乎多了一封信。": "Afternoon light rests on the mailbox lid. There seems to be a new letter inside.",
  "信箱被黄昏染成暗金色。里面似乎多了一封信。": "Dusk turns the mailbox a muted gold. There seems to be a new letter inside.",
  "门外很安静。信箱里似乎有什么东西。": "It is quiet outside. Something seems to be waiting in the mailbox.",
  "拆开来信": "Open the letter",
  "回到房间里吧。": "Let's go back inside.",
  "纸页在早晨的光线里显得很干净。": "The pages look especially clean in the morning light.",
  "午后的光停在桌沿，也许正适合写下此刻。": "Afternoon light rests on the desk. Perhaps this is the moment to write.",
  "天色渐暗，也许正适合整理今天的片段。": "The light is fading. Perhaps it is time to gather today's fragments.",
  "台灯照亮了桌面上仅剩的一小块地方。": "The desk lamp lights the last small patch of the tabletop.",
  "开始书写": "Start writing",
  "已经有一些零散的声音被整理到这里了。": "A few scattered voices have already been gathered here.",
  "要去检查一下信箱吗？": "Should I check the mailbox?",
  "书桌 · 返回房间": "Desk · Return to room",
  "正在连接": "Connecting",
  "已连接": "Connected",
  "当前离线": "Offline",
  "导出": "Export",
  "02 / 书桌": "02 / Desk",
  "我的纸页": "My pages",
  "新纸页": "New page",
  "纸页浏览方式": "Page browsing mode",
  "按分类": "By category",
  "按标签": "By tag",
  "纸页分类": "Page categories",
  "纸页标签": "Page tags",
  "未分类": "Unclassified",
  "碎片": "Fragment",
  "主题": "Theme",
  "书信": "Letter",
  "书籍": "Book",
  "日记": "Journal",
  "标签": "Tags",
  "还没有标签。可以在纸页上写下第一个。": "No tags yet. Add the first one to a page.",
  "这里还没有纸页。": "There are no pages here yet.",
  "一张新的纸": "A new page",
  "从这里继续写。": "Continue writing here.",
  "纸页可以先只是碎片，也可以成为主题、书信或一本正在生长的书。": "A page can begin as a fragment, or grow into a theme, letter, journal entry, or book.",
  "添加纸页": "Add page",
  "碎片纸页": "Fragment page",
  "主题纸页": "Theme page",
  "书信纸页": "Letter page",
  "书籍纸页": "Book page",
  "日记纸页": "Journal page",
  "未分类纸页": "Unclassified page",
  "尚未保存": "Not saved yet",
  "最近保存": "Last saved",
  "最近整理": "Last arranged",
  "已保存": "Saved",
  "有未保存修改": "Unsaved changes",
  "正在打开…": "Opening…",
  "正在保存…": "Saving…",
  "保存失败": "Save failed",
  "还没有写下内容": "Nothing written yet",
  "展开书写": "Expand editor",
  "收起纸页": "Collapse page",
  "删除": "Delete",
  "保存纸页": "Save page",
  "保存修改": "Save changes",
  "可继续书写": "Still being written",
  "分类": "Category",
  "标签": "Tags",
  "学术，伊萨卡手记": "research, Ithaca Journal",
  "收信人": "Recipient",
  "写给谁？": "Who is this for?",
  "手记标题": "Page title",
  "题目（可选）": "Title (optional)",
  "手记正文": "Page body",
  "今天想留下什么？": "What would you like to leave here today?",
  "内容不会写入应用日志": "Your content is never written to application logs",
  "查看来源主题板": "View source theme board",
  "寄出这封信": "Send this letter",
  "装订并上架": "Bind and shelve",
  "公告板 · 返回房间": "Board · Return to room",
  "把散落的纸页拼成一个问题": "Arrange scattered pages into a question",
  "新主题板": "New theme board",
  "带回书桌继续写": "Bring to the desk and keep writing",
  "03 / 公告板": "03 / Board",
  "主题板": "Theme boards",
  "每块板保存一组碎片及其空间关系。": "Each board preserves a set of fragments and their spatial relationships.",
  "还没有主题板。": "There are no theme boards yet.",
  "从散页到关系": "From loose pages to relationships",
  "哪些碎片正在谈论同一个问题？": "Which fragments are speaking about the same question?",
  "建立一块主题板，再从素材托盘把碎片放进画布。": "Create a theme board, then move fragments from the tray onto the canvas.",
  "建立第一块主题板": "Create the first theme board",
  "03 / 主题映射": "03 / Theme mapping",
  "布局已保存": "Layout saved",
  "布局已自动保存": "Layout autosaved",
  "正在自动保存…": "Autosaving…",
  "布局保存失败": "Layout save failed",
  "散页模式": "Loose-page mode",
  "拼图商店": "Puzzle shop",
  "自动整理": "Auto-arrange",
  "自动拼合": "Auto-fit",
  "调整主题": "Edit theme",
  "删除主题": "Delete theme",
  "碎片托盘": "Fragment tray",
  "从纸匣取用素材": "Take material from the paper tray",
  "只显示碎片分类。拖到右侧，或使用“加入主题”；原纸页仍留在书桌。": "Only fragment pages appear here. Drag one to the right or choose “Add to theme”; the original remains on the desk.",
  "还没有碎片纸页。先回书桌留下一张纸。": "There are no fragment pages yet. Return to the desk and leave one there first.",
  "拼图映射画布": "Puzzle mapping canvas",
  "摆放这些碎片笔记": "Arrange these fragment notes",
  "按住并拖动拼片，靠近正确位置会自动吸附；双击拼片查看对应文字。": "Drag a piece near its correct position to snap it into place; double-click it to read the text.",
  "主题画布还空着": "The theme canvas is empty",
  "从左边取一张笔记纸页。积累到指定数量后，可以去拼图商店永久兑换一套拼图。": "Take a note from the left. Once you have enough fragments, you can permanently unlock a puzzle in the shop.",
  "信箱 · 返回房间": "Mailbox · Return to room",
  "收下抵达的信，也留下寄出的回声": "Receive the letters that arrive and keep the echoes you send",
  "写一封信": "Write a letter",
  "04 / 信箱": "04 / Mailbox",
  "往来信件": "Correspondence",
  "寄件记录": "Sent letters",
  "信箱文件夹": "Mailbox folders",
  "收件箱": "Inbox",
  "寄件箱": "Sent",
  "这里还没有信。": "There are no letters here yet.",
  "还没有信抵达。": "No letters have arrived yet.",
  "还没有寄出过信。": "No letters have been sent yet.",
  "纸上的往来": "Correspondence on paper",
  "选择一封信。": "Choose a letter.",
  "这里还没有寄件。": "There are no sent letters yet.",
  "寄件箱保存已经寄出的信，也可以从这里继续整理和书写。": "Sent keeps letters you have already mailed and lets you continue organizing and writing from here.",
  "收件箱保存旅途中抵达的来信；寄件箱记录现实中已经寄出的信，仍可继续整理。": "The inbox keeps letters that arrive during the journey; Sent records letters mailed in real life and lets you keep managing them.",
  "回信": "Reply",
  "由此建立新草稿": "Create a new draft from this",
  "编辑记录": "Edit record",
  "删除记录": "Delete record",
  "管理寄件": "Manage sent letter",
  "修正寄件记录": "Edit sent-letter record",
  "“寄出”记录现实中的寄送。修改这里只整理应用中的记录，不会改变寄出时间或原始草稿。": "“Sent” records a real-life mailing. Editing here only organizes the app record; it does not change the sent time or original draft.",
  "标题（可选）": "Title (optional)",
  "这封信的题目": "Letter title",
  "正文": "Body",
  "保存寄件记录": "Save sent-letter record",
  "书架 · 返回房间": "Bookshelf · Return to room",
  "这里陈列已经完成的书，书稿仍留在书桌": "Finished books live here; their drafts remain on the desk",
  "开始一本书": "Start a book",
  "05 / 书架": "05 / Bookshelf",
  "我的成书": "My finished books",
  "书架还空着。可以从一份空白书稿开始。": "The shelf is empty. You can begin with a blank manuscript.",
  "从书稿到成书": "From manuscript to book",
  "一本书可以从空白开始。": "A book can begin from a blank page.",
  "在书桌写作，完成后装订成独立快照。之后修改书稿，也不会悄悄改写已经上架的书。": "Write at the desk, then bind a finished snapshot. Later edits to the manuscript will never quietly rewrite the shelved book.",
  "开始第一本书": "Start the first book",
  "完成于": "Completed",
  "从书架移除": "Remove from shelf",
  "整理主题": "Organize theme",
  "先为这个主题留一个位置": "Make a place for this theme",
  "主题名称": "Theme name",
  "例如：抵达与离开": "For example: Arrivals and Departures",
  "主题说明（可选）": "Theme notes (optional)",
  "写下关联、矛盾、重复出现的意象，或一个仍待回答的问题。": "Describe connections, tensions, recurring images, or a question still waiting for an answer.",
  "创建后会进入主题工作台，再从左侧把碎片放进画布。": "After creation, the theme workspace opens so you can move fragments from the left onto the canvas.",
  "取消": "Cancel",
  "创建并进入画布": "Create and open canvas",
  "保存主题说明": "Save theme notes",
  "主题拼图商店": "Theme puzzle shop",
  "用写下的碎片，换一副新的轮廓": "Use the fragments you wrote to unlock a new shape",
  "兑换只检查当前画布中的碎片数量，不会删除、消耗或移走任何文字。": "Unlocking checks only the number of fragments on this canvas. It never deletes, consumes, or moves your writing.",
  "移出当前主题": "Remove from this theme",
  "返回拼图": "Return to puzzle",
  "往日来信": "Earlier letters",
  "收起信件": "Fold letter",
  "危险操作": "Destructive action",
  "删除这幅主题拼图？": "Delete this theme puzzle?",
  "碎片纸页会保留；已经编纂完成的书也会保留自己的内容快照。": "Fragment pages will remain, and finished books will keep their own snapshots.",
  "确认删除": "Delete",
  "从书架移除这本书？": "Remove this book from the shelf?",
  "删除后无法恢复，但原始主题与碎片不会受到影响。": "This cannot be undone, but the original themes and fragments will not be affected.",
  "确认移除": "Remove",
  "删除这封寄件记录？": "Delete this sent-letter record?",
  "只会从寄件箱移除应用中的记录，不会删除原始草稿，也不会改变现实中已经寄出的信。删除后无法恢复。": "This only removes the app record from Sent. It does not delete the original draft or change the letter mailed in real life. This cannot be undone.",
  "删除这则碎片？": "Delete this page?",
  "删除后无法从应用中恢复；引用它的主题会保留，但素材脉络中将不再包含这则碎片。你可以先导出全部数据。": "This cannot be recovered in the app. Themes that reference it will remain, but the fragment will disappear from their material trail. You can export all data first.",
  "永久删除": "Permanent deletion",
  "删除全部云端数据？": "Delete all cloud data?",
  "输入": "Enter",
  "以继续": "to continue",
  "永久删除": "Delete permanently",
  "标签下还没有纸页。": "There are no pages with this tag yet.",
  "没有题目的纸页": "Untitled page",
  "这张纸上只留下了一个题目。": "Only a title has been left on this page.",
  "新": "New",
  "寄": "Sent",
  "今日": "Today",
  "未署名收信人": "unnamed recipient",
  "暂时无法进入旅程，请稍后重试。": "The journey cannot be entered right now. Please try again shortly.",
  "需要访问验证": "Access verification required",
  "只有管理员加入允许名单的邮箱可以接收验证码并进入测试。": "Only email addresses invited by the administrator can receive a code and enter the preview.",
  "当前访问身份无效或已经过期。": "The current access identity is invalid or has expired.",
  "暂时无法进入": "Unable to enter right now",
  "应用没有建立本地替代存档，以免与云端数据分叉。": "The app did not create a separate local archive, preventing it from diverging from cloud data.",
  "暂时无法连接服务，请稍后重试。": "The service is temporarily unavailable. Please try again shortly.",
  "需要重新登录": "Sign in again",
  "Cloudflare Access 会话已经失效。重新登录不会删除已有手记。": "Your Cloudflare Access session has expired. Signing in again will not delete your journal.",
  "请重新完成邮箱验证码登录。": "Please sign in again with the email verification code.",
  "这张纸还有未保存的修改。确定舍下它并离开吗？": "This page has unsaved changes. Leave them behind and continue?",
  "先写下一句话，再保存这张纸。": "Write one sentence before saving this page.",
  "纸页修改已经保存。": "Page changes saved.",
  "纸页已经放回书桌。": "The page has been returned to the desk.",
  "纸页已经删除。": "The page has been deleted.",
  "导出文件已经生成。": "The export file is ready.",
  "主题说明已经更新。": "Theme notes updated.",
  "主题已经建立，从左侧取一张碎片开始吧。": "The theme is ready. Begin with a fragment from the left.",
  "主题已经删除，原始碎片仍然保留。": "The theme has been deleted; its original fragments remain.",
  "信已经寄出，并作为寄件记录放进寄件箱。": "The letter has been sent and saved as a manageable record in Sent.",
  "先为这封信写下收信人。": "Add a recipient before sending this letter.",
  "请填写收信人。": "Add the recipient for this record.",
  "寄件记录已经更新。": "The sent-letter record has been updated.",
  "寄件记录已经删除，现实中的寄送不会受到影响。": "The sent-letter record has been deleted; the real-life mailing is unchanged.",
  "无法保存这封寄件记录。": "This sent-letter record could not be saved.",
  "无法删除这封寄件记录。": "This sent-letter record could not be deleted.",
  "书稿已经装订，并作为独立快照放上书架。": "The manuscript has been bound and shelved as an independent snapshot.",
  "这本书已经从书架移除，原书稿仍留在书桌。": "The book has been removed from the shelf; its manuscript remains on the desk.",
});

function normalizeLocale(locale) {
  return String(locale ?? "").toLowerCase().startsWith("en") ? "en" : "zh-CN";
}

function translatePattern(value) {
  let match = value.match(/^([＋+]\s*)(.+)$/u);
  if (match) return `${match[1]}${translateText(match[2], "en")}`;
  match = value.match(/^(.+)：(.+)$/u);
  if (match) return `${translateText(match[1], "en")}: ${translateText(match[2], "en")}`;
  match = value.match(/^第\s*(\d+)\s*天\s*·\s*回到你的房间$/u);
  if (match) return `Day ${match[1]} · Return to your room`;
  match = value.match(/^第\s*(\d+)\s*天来信$/u);
  if (match) return `Letter from day ${match[1]}`;
  match = value.match(/^第\s*(\d+)\s*天$/u);
  if (match) return `Day ${match[1]}`;
  match = value.match(/^(\d+)\s*\/\s*(\d+)\s*已解锁$/u);
  if (match) return `${match[1]} / ${match[2]} unlocked`;
  match = value.match(/^(\d[\d,]*)\s*个字符$/u);
  if (match) return `${match[1]} characters`;
  match = value.match(/^(\d+)\s*张$/u);
  if (match) return `${match[1]} pages`;
  match = value.match(/^(.+)里还没有纸页。$/u);
  if (match) return `There are no pages in ${translateText(match[1], "en").toLowerCase()} yet.`;
  match = value.match(/^最近保存：(.*)$/u);
  if (match) return `Last saved: ${translatePattern(match[1])}`;
  match = value.match(/^最近整理：(.*)$/u);
  if (match) return `Last arranged: ${translatePattern(match[1])}`;
  match = value.match(/^寄出于\s*(.*)$/u);
  if (match) return `Sent ${translatePattern(match[1])}`;
  match = value.match(/^寄给\s*(.*?)\s*·\s*(.*)$/u);
  if (match) return `To ${match[1]} · ${translatePattern(match[2])}`;
  match = value.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s*(.*))?$/u);
  if (match) return `${match[2]}/${match[3]}/${match[1]}${match[4] ? ` ${match[4]}` : ""}`;
  match = value.match(/^(\d{1,2})月(\d{1,2})日$/u);
  if (match) return `${match[1]}/${match[2]}`;
  const weekdays = { 星期一: "Monday", 星期二: "Tuesday", 星期三: "Wednesday", 星期四: "Thursday", 星期五: "Friday", 星期六: "Saturday", 星期日: "Sunday", 周一: "Mon", 周二: "Tue", 周三: "Wed", 周四: "Thu", 周五: "Fri", 周六: "Sat", 周日: "Sun" };
  if (weekdays[value]) return weekdays[value];
  return value;
}

export function translateText(value, locale = "zh-CN") {
  const source = String(value ?? "");
  if (normalizeLocale(locale) !== "en" || !source) return source;
  return ENGLISH[source] ?? translatePattern(source);
}

function browserStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function createI18n({ documentRoot = document, storage = browserStorage() } = {}) {
  let locale = normalizeLocale(storage?.getItem?.(STORAGE_KEY));
  let observer = null;
  const textRecords = new WeakMap();
  const attributeRecords = new WeakMap();
  const translatedAttributes = ["aria-label", "placeholder", "title", "data-scene-object-label"];

  function renderTextNode(node) {
    if (!node?.parentElement || node.parentElement.closest("script, style, [data-i18n-skip]")) return;
    const current = node.nodeValue ?? "";
    const previous = textRecords.get(node);
    const source = previous && current === previous.rendered ? previous.source : current;
    const trimmed = source.trim();
    if (!trimmed) return;
    const translated = translateText(trimmed, locale);
    const rendered = translated === trimmed
      ? source
      : `${source.slice(0, source.indexOf(trimmed))}${translated}${source.slice(source.indexOf(trimmed) + trimmed.length)}`;
    textRecords.set(node, { source, rendered });
    if (current !== rendered) node.nodeValue = rendered;
  }

  function renderAttribute(element, name) {
    if (!element.hasAttribute(name) || element.closest("[data-i18n-skip]")) return;
    let records = attributeRecords.get(element);
    if (!records) {
      records = new Map();
      attributeRecords.set(element, records);
    }
    const current = element.getAttribute(name) ?? "";
    const previous = records.get(name);
    const source = previous && current === previous.rendered ? previous.source : current;
    const rendered = translateText(source, locale);
    records.set(name, { source, rendered });
    if (current !== rendered) element.setAttribute(name, rendered);
  }

  function apply(root = documentRoot.documentElement) {
    if (!root) return;
    if (root.nodeType === 3) {
      renderTextNode(root);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    const ownerDocument = root.ownerDocument ?? documentRoot;
    const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      renderTextNode(node);
      node = walker.nextNode();
    }
    const elements = root.nodeType === 1 ? [root, ...root.querySelectorAll("*")] : [...root.querySelectorAll("*")];
    for (const element of elements) {
      for (const name of translatedAttributes) renderAttribute(element, name);
    }
    const description = documentRoot.querySelector?.('meta[name="description"]');
    if (description) {
      const source = description.dataset.i18nSource ?? description.content;
      description.dataset.i18nSource = source;
      description.content = translateText(source, locale);
    }
  }

  function setLocale(nextLocale) {
    locale = normalizeLocale(nextLocale);
    storage?.setItem?.(STORAGE_KEY, locale);
    documentRoot.documentElement.lang = locale;
    documentRoot.documentElement.dataset.locale = locale;
    apply();
    documentRoot.dispatchEvent(new CustomEvent("ithaca:localechange", { detail: { locale } }));
  }

  function start() {
    documentRoot.documentElement.lang = locale;
    documentRoot.documentElement.dataset.locale = locale;
    apply();
    if (typeof MutationObserver === "function") {
      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "characterData") renderTextNode(mutation.target);
          if (mutation.type === "attributes") renderAttribute(mutation.target, mutation.attributeName);
          for (const node of mutation.addedNodes ?? []) apply(node);
        }
      });
      observer.observe(documentRoot.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: translatedAttributes,
      });
    }
    return locale;
  }

  function stop() {
    observer?.disconnect();
    observer = null;
  }

  return Object.freeze({
    apply,
    getLocale: () => locale,
    setLocale,
    start,
    stop,
    translate: (value) => translateText(value, locale),
  });
}
