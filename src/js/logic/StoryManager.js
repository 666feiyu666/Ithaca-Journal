/* src/js/logic/StoryManager.js */
import { UserData } from '../data/UserData.js';
import { Library } from '../data/Library.js';
import { UIRenderer } from '../ui/UIRenderer.js';
import { ModalManager } from '../ui/ModalManager.js';

// 📝 补充定义：防止报错，定义第一本书的配置
const GUIDE_BOOK_CONFIG = {
    id: "guide_book_part1",
    title: "伊萨卡手记 I",
    cover: "assets/images/booksheet/booksheet0.png",
    content: "# 伊萨卡手记 I：序言\n\n欢迎来到伊萨卡。\n这里是流浪者的终点，也是书写者的起点...",
    isMystery: true
};

export const StoryManager = {
    // ============================================================
    // 1. 碎片与合成配置
    // ============================================================
    fragmentDB: {
        "frag_pineapple_01": {
            title: "待开发日记1",
            content: "...",
            origin: "字数里程碑",
            icon: "assets/images/item/note1.png"
        },
        "frag_pineapple_02": {
            title: "待开发日记2",
            content: "...",
            origin: "字数里程碑",
            icon: "assets/images/item/note1.png"
        },
        "frag_pineapple_03": {
            title: "待开发日记3",
            content: "...",
            origin: "高阶里程碑或探索",
            icon: "assets/images/item/note1.png"
        }
    },

    synthesisRecipes: [
        {
            bookId: "book_pineapple_diary_complete",
            title: "糖水菠萝的日记",
            cover: "assets/images/booksheet/booksheet1.png",
            requiredFragments: ["frag_pineapple_01", "frag_pineapple_02", "frag_pineapple_03"],
            fullContent: `# 糖水菠萝的日记 (完整版)\n\n...`
        }
    ],

    milestones: [
        { threshold: 20,   fragmentId: "frag_pineapple_01" },
        { threshold: 200,  fragmentId: "frag_pineapple_02" },
        { threshold: 2000, fragmentId: "frag_pineapple_03" }
    ],

    // ============================================================
    // 2. 核心逻辑
    // ============================================================

    checkWordCountMilestones() {
        const currentWords = UserData.state.totalWords || 0;
        this.milestones.forEach(ms => {
            if (currentWords >= ms.threshold) {
                this.unlockFragment(ms.fragmentId);
            }
        });
    },

    unlockFragment(fragmentId) {
        const isNew = UserData.addFragment(fragmentId);
        if (isNew) {
            const fragInfo = this.fragmentDB[fragmentId];
            if (!fragInfo) return;

            const room = document.getElementById('scene-room');
            if(room) {
                room.classList.add('shake-room');
                setTimeout(() => room.classList.remove('shake-room'), 500);
            }

            this.showDialogue("✨ 发现碎片", 
                `你捡到了一张泛黄的纸片：<br><strong style="font-size:1.1em;">《${fragInfo.title}》</strong><br><br>` + 
                `<span style="color:#666; font-size:0.9em; font-style:italic;">"${fragInfo.content.substring(0, 25)}..."</span>`
            );
            this.checkSynthesis();
        }
    },

    checkSynthesis() {
        this.synthesisRecipes.forEach(recipe => {
            const alreadyHasBook = Library.getAll().find(b => b.id === recipe.bookId);
            if (alreadyHasBook) return;

            const hasAllFragments = recipe.requiredFragments.every(fid => UserData.hasFragment(fid));

            if (hasAllFragments) {
                Library.addBook({
                    id: recipe.bookId,
                    title: recipe.title,
                    content: recipe.fullContent,
                    cover: recipe.cover,
                    date: "重组的记忆",
                    isMystery: true,     
                    isReadOnly: true
                });

                setTimeout(() => {
                    this.showDialogue("📚 记忆重组", 
                        `手中的碎片仿佛受到了感召，自动拼凑在了一起。<br><br>获得完整书籍：<br><strong style="font-size:1.3em; color:#d84315;">《${recipe.title}》</strong>`
                    );
                    if(document.getElementById('modal-bookshelf-ui').style.display === 'flex') {
                        UIRenderer.renderBookshelf();
                    }
                }, 2500);
            }
        });
    },

    // ============================================================
    // 3. UI 与场景控制
    // ============================================================

    showDialogue(title, htmlContent) {
        const scene = document.getElementById('scene-intro');
        const bgImg = scene.querySelector('.intro-bg');
        const skipBtn = document.getElementById('btn-skip-intro');
        const speakerEl = document.getElementById('dialogue-speaker');
        const textEl = document.getElementById('dialogue-text');
        const box = document.getElementById('intro-dialogue-box');
        
        const room = document.getElementById('scene-room'); 
        const isCityMode = (room && window.getComputedStyle(room).display === 'none');

        scene.style.display = 'flex';
        scene.style.opacity = 1;
        scene.style.background = 'rgba(0, 0, 0, 0.7)'; 
        
        if (bgImg) isCityMode ? bgImg.style.display = 'block' : bgImg.style.display = 'none';
        if (skipBtn) skipBtn.style.display = 'none';

        speakerEl.innerText = title;
        speakerEl.style.color = "#d84315"; 
        textEl.innerHTML = htmlContent;
        
        box.style.display = 'flex';
        box.onclick = () => {
            const currentCityMode = (room && window.getComputedStyle(room).display === 'none');
            if (currentCityMode) {
                box.style.display = 'none';
                scene.style.background = 'rgba(0, 0, 0, 0.2)'; 
            } else {
                scene.style.display = 'none';
                scene.style.background = ''; 
                if (bgImg) bgImg.style.display = 'block';
            }
            speakerEl.style.color = ""; 
            box.onclick = null;
        };
    },

    showSceneDialogue(title, htmlContent, bgSrc) {
        // ... (保持原有逻辑，简略) ...
        const scene = document.getElementById('scene-intro');
        const bgImg = scene.querySelector('.intro-bg');
        const room = document.getElementById('scene-room');
        const skipBtn = document.getElementById('btn-skip-intro');
        const speakerEl = document.getElementById('dialogue-speaker');
        const textEl = document.getElementById('dialogue-text');
        const box = document.getElementById('intro-dialogue-box');

        if (room) room.style.display = 'none';
        scene.style.display = 'flex';
        scene.style.opacity = 1;
        if (bgImg) { bgImg.style.display = 'block'; bgImg.src = bgSrc; }
        scene.style.background = 'rgba(0, 0, 0, 0.2)'; 
        if (skipBtn) skipBtn.style.display = 'none';
        box.style.display = 'flex';

        speakerEl.innerText = title;
        speakerEl.style.color = "#d84315"; 
        textEl.innerHTML = htmlContent;
        box.onclick = () => { box.style.display = 'none'; box.onclick = null; };
    },

    returnHome() {
        const scene = document.getElementById('scene-intro');
        const bgImg = scene.querySelector('.intro-bg');
        const room = document.getElementById('scene-room');
        const box = document.getElementById('intro-dialogue-box');

        scene.style.display = 'none';
        if (room) room.style.display = 'block';
        if (box) box.style.display = 'flex';
        if (bgImg) { bgImg.style.display = 'block'; bgImg.src = 'assets/images/city/street0.png'; }
    },

    // ============================================================
    // 4. 剧情脚本
    // ============================================================
    scripts: {
        find_first_note: [
            { speaker: "我", text: "既然已经住下了，整理一下这边的旧书架吧。" },
            { speaker: "我", text: "（指尖划过书脊的声音）" },
            { speaker: "我", text: "嗯？最上层深处好像卡着什么东西……" },
            { speaker: "我", text: "（用力拉拽的声音）" },
            { speaker: "我", text: "掉出来一本封面是绿色的书，上面印着：'伊萨卡手记 I：序言'。" }
        ],
        package_day_7: [
            { speaker: "系统", text: "（笃笃笃—— 门外传来了敲门声）" },
            { speaker: "我", text: "谁？" },
            { speaker: "系统", text: "（无人应答。你打开门，发现地毯上放着一个牛皮纸包裹）" },
            { speaker: "我", text: "寄件人是……'糖水菠萝'" },
            { speaker: "我", text: "拆开看看吧。" },
            { speaker: "系统", text: "你获得了：《伊萨卡手记 II》。已自动放入书架。" }
        ],
        package_day_14: [
            { speaker: "我", text: "门口好像又有动静了。" },
            { speaker: "系统", text: "（还是那个熟悉的牛皮纸包裹，静静地躺在门口）" },
            { speaker: "系统", text: "你获得了：《伊萨卡手记 III》。已自动放入书架。" }
        ],
        package_day_21: [
            { speaker: "我", text: "看来今天也是收快递的日子。" },
            { speaker: "系统", text: "（包裹如约而至，上面还附着一片干枯的橄榄叶）" },
            { speaker: "系统", text: "你获得了：《伊萨卡手记 IV》。已自动放入书架。" }
        ],
        mail_reaction_day1: [
            { speaker: "我", text: "什么鬼，是不是寄错了？" },
            { speaker: "我", text: "（合上信纸）" }
        ],
        mail_reaction_day3: [ 
            { speaker: "我", text: "……" },
            { speaker: "我", text: "……" }
        ],
        mail_reaction_day7: [ 
            { speaker: "我", text: "……" },
            { speaker: "我", text: "……" }
        ],
    },

    currentIndex: 0,
    activeScript: null,

    /**
     * 🟢 核心重构：尝试触发书架剧情
     */
    tryTriggerBookshelfStory() {
        if (UserData.state.hasFoundMysteryEntry || !UserData.state.hasWatchedIntro) {
            return false; 
        }
        
        // 1. 开始特定剧情
        this.startStory('find_first_note');

        // 2. 设置回调
        this._onStoryComplete = () => {
            // 记录状态
            UserData.state.hasFoundMysteryEntry = true;
            UserData.save();

            // 确保书本存在
            const targetId = GUIDE_BOOK_CONFIG.id;
            const exists = Library.getAll().find(b => b.id === targetId);

            if (!exists) {
                Library.addBook(GUIDE_BOOK_CONFIG);
            } else {
                exists.isReadOnly = true; 
            }

            // 提示文案
            UIRenderer.log("📖 你发现了《伊萨卡手记 I》");

            // 🔥 3. 修复：使用 ModalManager 打开书架，并强制刷新渲染
            // ModalManager.open('modal-bookshelf-ui');
            // 暂时不知道如何修复自动打开书架后书不显示的问题

            // 延迟一丢丢渲染，确保 DOM 已经完全可见 (双重保险)
            setTimeout(() => {
                UIRenderer.renderBookshelf();
            }, 50);
        };

        return true;
    },

    startStory(scriptKey) {
        this.activeScript = this.scripts[scriptKey];
        this.currentIndex = 0;
        
        const scene = document.getElementById('scene-intro');
        scene.style.display = 'flex';
        scene.style.opacity = 1;
        scene.style.background = 'rgba(0, 0, 0, 0.4)'; 
        
        const bgImg = scene.querySelector('.intro-bg');
        if (bgImg) bgImg.style.display = 'none';

        document.getElementById('btn-skip-intro').style.display = 'none';
        this.renderLine();
    },

    renderLine() {
        const line = this.activeScript[this.currentIndex];
        document.getElementById('dialogue-speaker').innerText = line.speaker;
        document.getElementById('dialogue-text').innerText = line.text;
        
        if (line.text.includes("用力拉拽")) {
            const room = document.getElementById('scene-room');
            if(room) {
               room.classList.add('shake-room');
               setTimeout(() => room.classList.remove('shake-room'), 500);
            }
        }

        const box = document.getElementById('intro-dialogue-box');
        box.onclick = () => this.next();
    },

    next() {
        this.currentIndex++;
        if (this.currentIndex < this.activeScript.length) {
            this.renderLine();
        } else {
            this.endStory();
        }
    },

    /**
     * 🟢 核心重构：通用的剧情结束处理
     * 不再包含任何特定书籍的逻辑
     */
    endStory() {
        const scene = document.getElementById('scene-intro');
        scene.style.display = 'none';

        const bgImg = scene.querySelector('.intro-bg');
        if (bgImg) bgImg.style.display = 'block';

        const box = document.getElementById('intro-dialogue-box');
        box.onclick = null; 

        // 执行回调 (例如：弹出读后感、解锁书籍、刷新UI等)
        if (this._onStoryComplete) {
            this._onStoryComplete();
            this._onStoryComplete = null;
        }
    },

    // ============================================================
    // 每日特殊事件检测 (同样修复这里，防止包裹事件也出现一样的问题)
    // ============================================================
    checkDailyEvents() {
        const day = UserData.state.day;

        // 通用回调生成器
        const createPackageCallback = (bookId, logText) => {
             return () => {
                Library.unlockSystemBook(bookId); // 这里的 id 是 2, 3, 4
                UIRenderer.log(logText);
                
                // 🔥 修复：如果书架已经打开，就刷新它；没打开就不管，等用户自己打开
                const bookshelfModal = document.getElementById('modal-bookshelf-ui');
                if(bookshelfModal && bookshelfModal.style.display !== 'none') {
                    UIRenderer.renderBookshelf();
                } else {
                    // 如果你想让包裹事件结束后自动弹开书架，解开下面这行的注释：
                    // ModalManager.open('modal-bookshelf-ui'); UIRenderer.renderBookshelf();
                }
            };
        };

        if (day >= 7 && !Library.hasBook("guide_book_part2")) {
            this.startStory('package_day_7');
            this._onStoryComplete = createPackageCallback(2, "📦 收到了新的手记。");
            return;
        }

        if (day >= 14 && !Library.hasBook("guide_book_part3")) {
            this.startStory('package_day_14');
            this._onStoryComplete = createPackageCallback(3, "📦 收到了新的手记。");
            return;
        }

        if (day >= 21 && !Library.hasBook("guide_book_part4")) {
            this.startStory('package_day_21');
            this._onStoryComplete = createPackageCallback(4, "📦 收到了新的手记。");
            return;
        }
    },

    /**
     * 尝试触发邮件读后感
     */
    tryTriggerMailReaction(day, onComplete) {
        const scriptKey = `mail_reaction_day${day}`;
        
        if (this.scripts[scriptKey]) {
            console.log(`[StoryManager] 触发邮件读后感: ${scriptKey}`);
            
            setTimeout(() => {
                this.startStory(scriptKey);

                // 🔥 关键：设置剧情结束后的回调
                this._onStoryComplete = () => {
                    // 1. 先执行传入的回调（即弹出读后感）
                    if (onComplete) {
                        onComplete();
                    }
                    // 2. 然后再检查有没有其他事件（如包裹）
                    // ⚠️ 注意：不要在这里直接调用 checkDailyEvents 开启新剧情，
                    // 否则两个弹窗会打架。最好是在读后感关闭后再检查。
                    // 但为了简单起见，这里先保留原逻辑，或者你可以在 onComplete 内部自行安排。
                };
            }, 300); 
            
            return true; 
        }
        return false; 
    }
};