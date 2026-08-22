import { JOURNEY_TOTAL_DAYS } from "../config/journey";

export interface LetterContent {
  title: string;
  sender: string;
  content: string;
}

export type LetterCatalog = Readonly<Record<number, LetterContent>>;

export function assertLetterCatalog(
  letters: LetterCatalog,
  totalDays = JOURNEY_TOTAL_DAYS,
): void {
  const configuredDays = Object.keys(letters)
    .map(Number)
    .sort((left, right) => left - right);
  if (configuredDays.length !== totalDays) {
    throw new Error(`信件配置应包含 ${totalDays} 天，实际为 ${configuredDays.length} 天。`);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const letter = letters[day];
    if (!letter) throw new Error(`信件配置缺少第 ${day} 天。`);
    for (const field of ["title", "sender", "content"] as const) {
      if (!letter[field].trim()) throw new Error(`第 ${day} 天信件缺少 ${field}。`);
    }
  }
}

export const LETTERS: LetterCatalog = {
        // === 第一周：叙事 ===
        1: {
            title: "半年了",
            sender: "糖水菠萝",
            content: `To ???：
距离离职已经过了半年了。

想把这半年的经历整理一下，但是写给谁呢？我知道，理智的声音会说：“当然是写给自己啊，书写是为了内省。”

但人总归是软弱的动物。如果只是写给自己看，我总觉得像是在对着枯井喊话，回声只会让自己更显孤独。我觉得每个人都或多或少希望向别人分享自己的故事吧？

所以，假想一个听众也不是坏事。

还有半年，这间房子的租期就到了。按照概率，总会有下一个人的。那就不妨选你吧，未来的新房客。

其实离职之后，我就恢复了记日记的习惯……

（涂改的痕迹……信到这里就结束了）`
// 未来可以设置一个反应弹窗，引导用户“‘到这里就没有了，好奇怪’你心想”；同时可以埋一个钩子，在支线里补上“信的后续内容”。
        },
        2: {
            title: "2",
            sender: "糖水菠萝",
            content: `……`
        },
        3: {
            title: "3",
            sender: "糖水菠萝",
            content: `……`
        },
        4: {
            title: "4",
            sender: "糖水菠萝",
            content: `……`
        },
        5: {
            title: "5",
            sender: "糖水菠萝",
            content: `……`
        },
        6: {
            title: "6",
            sender: "糖水菠萝",
            content: `……`
        },
        7: {
            title: "7",
            sender: "糖水菠萝",
            content: `……`
        },

        // === 第二周 ===
        8: {
            title: "8",
            sender: "糖水菠萝",
            content: `……`
        },
        9: {
            title: "9",
            sender: "糖水菠萝",
            content: `……`
        },
        10: {
            title: "10",
            sender: "糖水菠萝",
            content: `……`
        },
        11: {
            title: "11",
            sender: "糖水菠萝",
            content: `……`
        },
        12: {
            title: "12",
            sender: "糖水菠萝",
            content: `……`
        },
        13: {
            title: "13",
            sender: "糖水菠萝",
            content: `……`
        },
        14: {
            title: "14",
            sender: "糖水菠萝",
            content: `……`
        },

        // === 第三周 ===
        15: {
            title: "15",
            sender: "糖水菠萝",
            content: `……`
        },
        16: {
            title: "16",
            sender: "糖水菠萝",
            content: `……`
        },
        17: {
            title: "17",
            sender: "糖水菠萝",
            content: `……`
        },
        18: {
            title: "18",
            sender: "糖水菠萝",
            content: `……`
        },
        19: {
            title: "19",
            sender: "糖水菠萝",
            content: `……`
        },
        20: {
            title: "20",
            sender: "糖水菠萝",
            content: `……`
        },
        21: {
            title: "21",
            sender: "糖水菠萝",
            content: `To ???:
今天是第21天。按照心理学的研究，21天可以养成一个新习惯。

但是，在落笔今天这封信的时候，一种奇怪的感觉到达了顶峰。

我一开始在抬头写着“To 新房客”，但我总感觉……你并不是那个我想象中、接着我租房合同的陌生人。

我不确定你是谁，所以我只能称呼你为“？？？”。

但我能感觉到，你此刻正透过某种发光的界面注视着我。也许你并没有坐在我的这把旧椅子上，也许你身处的房间比这里明亮得多，也许你所处的城市里没有一所名叫加里敦的学院。

但我确信，你在读，你在听。

这种感觉很荒谬，对吧？就像舞台上的演员突然停下来，盯着漆黑的观众席说：“我看见你了。”

但我不想骗你，也不想骗我自己。之前我总说“书写是为了构建自我”，但现在我发现，故事同样是因为被阅读才存在的——就像你读到了我的故事一样。

谢谢你，身处另一个世界的你。

买来的信纸都用完了。那就先告一段落吧！

现在，把目光从屏幕（或者纸张？）上移开吧。看看你身边的世界，拿其你自己的笔。

不再是作为“新房客”，而是作为你那个世界的叙事者。

去吧，去写你自己的故事。

——糖水菠萝`
        }
};

assertLetterCatalog(LETTERS);
