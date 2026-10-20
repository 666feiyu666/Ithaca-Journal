# Journey 叙事源

本目录保存《伊萨卡手记》Journey 的长期叙事资产。Journey 讲述刚毕业的卡夫卡来到陌生城市求职，并在等待旺逸公司面试期间重新整理个人项目《伊萨卡手记》的经历。玩家沿作者编排的现实、回忆和设计稿推进故事。

本目录不以产品发布版本命名。`0.4.1`、`0.4.2` 等版本只表示某次产品发布采用了 Journey 的哪一份内容修订，不构成故事身份，也不得进入长期 passage ID。

## 文件职责

- `outline.md`：序章、四章、场景和交互的结构规格。它说明每段为何存在，但不复制完整对白。
- `story.zh-CN.twee`：中文剧情的权威作者源。正文、心理活动、选择和 passage 连接都在这里持续演化。
- `story.en.twee`：未来的英文作者源。中文第一稿稳定后再建立，并与中文使用相同 passage ID。
- 正式应用读取的 JavaScript 或 JSON 是生成物，应放在 `src/client/config/generated/` 一类运行时目录中，不得反向替代本目录的作者源。

## 当前边界

- 中文第一版已经接入原生 Journey 页面；Twee 是权威正文，生成文件不接受手工修改。
- 当前正文以中文为准；英文翻译不阻塞中文初稿。
- 图片、音频和最终动效不写死在正文中。passage 只使用 `scene-*`、`chapter-card` 等语义标签声明演出需要。
- 旧的 `prototypes/twine/story-a/` 属于此前的 Story A／Day 1 方向，不是本故事的上游文件，也不会继续扩写成本 Journey。
- 这是一部作者编排的视觉小说，不是开放式产品设计沙盒。选择和交互可以改变局部反馈与节奏，但不应无意中扩张成多条完全不同的产品路线。
- “伊萨卡小屋”只存在于《伊萨卡手记》的设计稿中。卡夫卡现实中住的是普通出租屋；两个空间不得在正文或演出中混为一体。

## 作者源与运行时

预期的数据流为：

```text
narrative/journey/story.zh-CN.twee
                  ↓ 编译与校验
       ┌──────────┴──────────┐
       ↓                     ↓
src/client/config/      src/server/generated/
generated/              journey-story.ts
journey-story.zh-CN.js        ↓
       ↓                服务端合法跳转与存档
原生 Journey 页面
```

运行 `npm run narrative:build` 会校验入口、标签、链接、可达性、结局和可见 TODO，再更新两份生成文件。`dev`、`test`、`check` 和 `build` 都会先执行这一步。正式应用继续拥有页面切换、视觉呈现、用户身份和服务端存档；不要把 SugarCube 生成的完整 HTML 直接嵌入 Journey，也不要让浏览器存档成为正式进度的权威来源。

## Passage 规则

### 稳定 ID

passage 名称只表达结构位置，不复用可能改变的标题或正文：

```twee
:: PROLOGUE_S01
:: CH01_S01
:: CH02_I06
:: CH03_END
:: CH04_END
```

- `S` 表示叙事场景或心理活动。
- `I` 表示需要专门交互呈现的场景。
- `CARD` 表示全屏章节卡。
- `END` 表示章节收束或最终结局。
- 修改章节标题、对白或场景文案时，不重命名稳定 ID。
- 删除已经进入正式存档的 passage 时，保留重定向或提供到本章入口的迁移规则。

### 标签

标签用于让未来编译器和运行时选择呈现方式。当前约定：

| 标签 | 含义 |
|---|---|
| `prologue`、`chapter-1`…`chapter-4` | 所属叙事章节 |
| `layer-reality`、`layer-design` | 现实层或《伊萨卡手记》设计稿层；每个 passage 必须且只能选择一个 |
| `chapter-card` | 全屏章节切换，不使用普通对白框 |
| `thought` | 开发者第一人称心理活动 |
| `narration` | 非对白叙述或场景说明 |
| `dialogue`、`speaker-kafka`、`speaker-interviewer` | 对白类型与可见说话人 |
| `scene-title`、`scene-desk`、`scene-room` 等 | 语义场景槽；未来由资源映射决定图片 |
| `interaction-*` | 由原生组件替换或增强的交互 passage |
| `feedback` | 交互错误、正确或局部结果文案 |
| `ending` | Journey 的最终收束 |

### 内容语法

- 文件使用 UTF-8 和 Twee 3 passage 结构。
- 普通推进使用 `[[按钮文案->PASSAGE_ID]]`。
- 正文优先保持为可读文本，不在作者源中堆积运行时 JavaScript。
- 不使用 `<<set>>`、`<<script>>` 等 SugarCube 专属宏保存正式状态。
- 特殊交互 passage 必须仍能只依靠普通链接走通，原生组件可以在此基础上增强演出。
- `TODO:` 只用于写作中的临时占位；编译器会拒绝把它生成到正式运行时。

## 版本与存档

以下三个概念必须分开：

| 名称 | 示例 | 所有者 |
|---|---|---|
| 产品发布版本 | `0.4.1` | `package.json`、发布记录 |
| Journey 内容修订 | `draft-01`、`content revision 3` | 作者源与编译产物元数据 |
| Journey 存档结构版本 | `story state schema 1` | 服务端存档与迁移逻辑 |

当前存档记录 `current_passage`、进行状态和开始／进入／完成时间。服务端只接受生成的 transition map 中存在的下一步；旧版的 `prologue` 或其他失效 passage 会安全回退到当前故事入口。完成后的再次进入会建立一次从序章开始的重访。

## 写作工作流

1. 先在 `outline.md` 确认章节功能、场景顺序和交互目的。
2. 在 `story.zh-CN.twee` 补写或改写正文，保持 passage ID 稳定。
3. 运行 `npm run narrative:build`，确认链接目标存在、入口唯一、章节可走通。
4. 运行 `npm test` 与 `npm run test:integration`，验证生成数据、客户端选择和服务端存档。
5. 运行 `npm run dev`，从序章走到结局，检查心理活动口吻、章节节奏、长文本和窄窗口布局。
6. 构建步骤生成正式应用数据；生成文件不得手工编辑。
7. 中文第一稿稳定后，再建立使用相同 passage ID 的英文文件。

## 完整初稿的最低标准

- 从 `PROLOGUE_S01` 可以连续走到 `CH04_END`。
- 四章均有独立章节卡、明确的开章状态与收束 passage。
- 序章必须明确标出“现实出租屋”和“伊萨卡小屋设计稿”，第一章才发生现实时间线中的旧项目重启。
- 第二章包含日记、碎片—主题—书籍、书信保存和 A/B/C 设计过程。
- agency／communion 场景包含错误反馈、正确反馈和 C 的未完成状态，但 A/B/C 只是赶在面试前形成的一个版本，不是全篇主题。
- 第三章完成项目展示、商业项目／流水追问和面试结束，不把面试官写成替作品总结主题的人。
- 第四章停留在面试时的 A/B/C 版本，不重新解释 C，也不出现下一版；项目在卡夫卡的自白中无疾而终。
- `TODO:` 在生成前清零。
