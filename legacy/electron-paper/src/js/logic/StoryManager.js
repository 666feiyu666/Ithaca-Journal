/* src/js/logic/StoryManager.js */
import { UserData } from '../data/UserData.js';
import { Library } from '../data/Library.js';
import { UIRenderer } from '../ui/UIRenderer.js';
import { Scripts } from '../data/Scripts.js'; // 确保正确导入

export const StoryManager = {
    
    // ============================================================
    // 1. UI 与场景控制 (供 FragmentSystem 和剧情系统共用)
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

    // 🟢 修改这个方法，增加 charSrc 参数
    showSceneDialogue(title, htmlContent, bgSrc, charSrc = null) {
        const scene = document.getElementById('scene-city');
        const bgImg = scene.querySelector('.intro-bg');
        
        // ✨ 获取立绘元素
        const charImg = document.getElementById('city-character');
        const room = document.getElementById('scene-room');
        const box = document.getElementById('city-dialogue-box');
        
        // 1. 显示场景层
        if (room) room.style.display = 'none';
        scene.style.display = 'flex';
        scene.style.opacity = 1;
        scene.style.background = 'rgba(0, 0, 0, 0.2)'; 
        
        // 2. 设置背景图
        if (bgImg) { 
            bgImg.style.display = 'block'; 
            bgImg.src = bgSrc; 
        }

        // ✨ 3. 设置立绘逻辑 (核心修改)
        if (charImg) {
            if (charSrc) {
                // 如果传了图片路径，就显示
                charImg.src = charSrc;
                charImg.style.display = 'block';
            } else {
                // 如果没传，一定要隐藏 (防止显示上一次的图片)
                charImg.style.display = 'none';
            }
        }

        // 4. 设置文本内容
        const speakerEl = document.getElementById('city-dialogue-speaker');
        const textEl = document.getElementById('city-dialogue-text');
        
        speakerEl.innerText = title;
        speakerEl.style.color = "#d84315"; 
        textEl.innerHTML = htmlContent;

        // 5. 绑定点击关闭事件
        box.style.display = 'flex';
        box.onclick = () => { 
            box.style.display = 'none'; 
            box.onclick = null; 
            // 注意：因为这里只是关闭对话框，背景还留着给玩家看
            // 真正的退出是靠 returnHome()，那里也要记得隐藏立绘
        };
    },

    // 🟢 修改 returnHome，确保回家时立绘消失
    returnHome() {
        const scene = document.getElementById('scene-city');
        const charImg = document.getElementById('city-character'); // ✨
        const room = document.getElementById('scene-room');
        const box = document.getElementById('city-dialogue-box');

        scene.style.display = 'none';
        
        // ✨ 确保回家时立绘隐藏，否则下次打开可能会闪现
        if (charImg) charImg.style.display = 'none';

        if (room) room.style.display = 'block';
        if (box) box.style.display = 'flex';
        
        // 重置背景为默认
        const bgImg = scene.querySelector('.intro-bg');
        if (bgImg) { bgImg.style.display = 'block'; bgImg.src = 'assets/images/city/street0.png'; }
    },
    
    // ============================================================
    // 2. 剧情播放核心 (State Management)
    // ============================================================

    currentIndex: 0,
    activeScript: null,
    activeScriptId: null,

    /**
     * 🟢 尝试触发书架剧情 (发现第一本书)
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

            // ✨【修复核心】：使用封装的方法解锁第一本书 (Part 1)
            // 之前这里引用了未定义的 GUIDE_BOOK_CONFIG
            Library.unlockSystemBook(1); 

            // 提示文案
            UIRenderer.log("📖 你发现了《伊萨卡手记 I》");
        };

        return true;
    },

    /**
     * 开始播放一段剧本
     */
    startStory(scriptKey) {
        const scriptData = Scripts[scriptKey];
        
        if (!scriptData) {
            console.error("未找到剧本:", scriptKey);
            return;
        }

        this.activeScript = scriptData.content; 
        this.activeScriptId = scriptKey;      
        this.currentIndex = 0;
        
        // ✅ 核心修复：记录该剧情已解锁 (方便ReviewLog显示)
        UserData.unlockScript(scriptKey); 

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
        
        // 简单的震动特效
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
     * 🟢 剧情结束处理
     */
    endStory() {
        const scene = document.getElementById('scene-intro');
        scene.style.display = 'none';

        const bgImg = scene.querySelector('.intro-bg');
        if (bgImg) bgImg.style.display = 'block';

        const box = document.getElementById('intro-dialogue-box');
        box.onclick = null; 

        // 执行回调
        if (this._onStoryComplete) {
            this._onStoryComplete();
            this._onStoryComplete = null;
        }
    },

    // ============================================================
    // 3. 每日事件与邮件交互
    // ============================================================
    checkDailyEvents() {
        const day = UserData.state.day;

        // 包裹事件回调生成器
        const createPackageCallback = (partIndex, logText) => {
             return () => {
                // ✨【修复】：调用 unlockSystemBook (Library现在已经支持此方法)
                Library.unlockSystemBook(partIndex); 
                UIRenderer.log(logText);
                
                const bookshelfModal = document.getElementById('modal-bookshelf-ui');
                if(bookshelfModal && bookshelfModal.style.display !== 'none') {
                    UIRenderer.renderBookshelf();
                } 
            };
        };

        // ✨【修复】：Library现在支持 hasBook 方法了，这里不会再报错
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
     * 🟢 尝试触发邮件读后感
     * (已修复之前的变量名错误)
     */
    tryTriggerMailReaction(day, onComplete) {
        const scriptKey = `mail_reaction_day${day}`;
        
        // 1. 检查剧本是否存在
        if (!Scripts[scriptKey]) {
            return false;
        }

        // 2. ✨ 新增：检查该剧情是否已经播放过/解锁过
        // 如果 UserData.state.unlockedScripts 包含该 key，说明看过了
        // 为了防止死循环（看过了剧情但没写读后感），我们这里定义：
        // "如果已经解锁过，就不再自动播放，直接返回 false 让外部弹出输入框"
        if (UserData.state.unlockedScripts && UserData.state.unlockedScripts.includes(scriptKey)) {
             console.log(`[StoryManager] 剧情 ${scriptKey} 已解锁，跳过播放，直接进入下一阶段。`);
             return false; 
        }
        
        console.log(`[StoryManager] 触发邮件读后感: ${scriptKey}`);
        
        // 3. 播放剧情
        setTimeout(() => {
            this.startStory(scriptKey);

            // 设置回调，当 endStory() 被调用时执行
            this._onStoryComplete = () => {
                if (onComplete) {
                    onComplete();
                }
            };
        }, 300); 
        
        return true; 
    }
};