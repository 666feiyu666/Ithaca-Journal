/* src/js/data/UserData.js */
import { Journal } from './Journal.js';

export const ACHIEVEMENTS = {
    'ach_home': { title: '安家', desc: '第一次装修房间', icon: '🏠' },
    'ach_diary': { title: '写日记', desc: '第一次记下思绪', icon: '✍️' },
    'ach_author': { title: '作家', desc: '第一次出版书籍', icon: '📘' },

    // === ✨ 新增成就 ===
    'ach_city': { title: '城市漂流', desc: '第一次离开家前往城市', icon: '🏙️' },
    'ach_pineapple': { title: 'i菠萝', desc: '累计阅读糖水菠萝的十封信', icon: '🍍' },

    // 收集成就 (Collection)
    'ach_ithaca_full': { title: '这就是伊萨卡手记', desc: '收集齐四篇《伊萨卡手记》残章', icon: '📖' },
    
    // 字数里程碑 (Progress)
    'ach_word_1k': { title: '积跬步', desc: '日记总字数达到 1,000 字', icon: '📝' },
    'ach_word_5k': { title: '至千里', desc: '日记总字数达到 5,000 字', icon: '✒️' },
    'ach_word_10k': { title: '个人史诗', desc: '日记总字数达到 10,000 字', icon: '📜' }

};

export const UserData = {
    state: {
        startDate: null, // 记录存档创建的时间戳
        day: 1,
        ink: 0,
        draft: "",
        inventory: [], // 背包：记录拥有哪些物品ID
        layout: [],    // 房间布局：记录摆出来的物品位置
        hasFoundMysteryBook: false, // 是否已获得神秘书籍
        totalWords: 0,   // 生涯总字数
        fragments: [],   // 已收集的碎片ID列表
        
        // ✨ 新增：手记本列表
        // 结构: { id: 'nb_xxx', name: '我的小说', icon: 'path/to/img', isDefault: boolean, createdAt: timestamp }
        notebooks: [], 
        readMails: [],   // 已读邮件ID列表
        achievements: [], // 已解锁成就ID列表

        // ✨ 新增：存储玩家对每日信件的回复/感想
        // 结构: { "1": "今天天气真好...", "2": "原来他是这个意思..." }
        mailReplies: {}, 
        
        // ✨ 新增：标记彩蛋书是否已领取
        hasReceivedEasterEggBook: false,
        unlockedScripts: [], // 已解锁的特殊剧情ID列表
    },

    // 初始化
    async init() {
        const saved = await window.ithacaSystem.loadData('user_data.json');
        
        // 标记是否为纯新用户（根据是否读取到存档来判断）
        let isNewUser = false;

        if (saved) {
            this.state = JSON.parse(saved);
            console.log("存档加载成功！内容：", this.state);
        } else {
            console.log("未找到存档，使用默认初始状态");
            isNewUser = true; // <--- 标记为新用户
        }

        // --- 1. 基础数据兼容性修补 ---
        if (!this.state.inventory) this.state.inventory = [];

        // 🛡️【新增修复】防止老玩家重复触发开场剧情
        // 逻辑：如果已经不是第一天了，或者已经有墨水积累了，说明肯定看过剧情了
        if (typeof this.state.hasWatchedIntro === 'undefined') {
            if (this.state.day > 1 || this.state.ink > 0 || this.state.totalWords > 0) {
                console.log("检测到老存档，自动标记为已看剧情");
                this.state.hasWatchedIntro = true;
            } else {
                // 确实是纯新号
                this.state.hasWatchedIntro = false;
            }
        }

        // ============================================================
        // 🟢 修复补充：旧存档剧情回顾数据迁移
        // ============================================================
        if (!this.state.unlockedScripts) this.state.unlockedScripts = [];

        // 1. 如果玩家看过开场白，补录 intro_scene
        if (this.state.hasWatchedIntro && !this.state.unlockedScripts.includes('intro_scene')) {
            this.state.unlockedScripts.push('intro_scene');
            console.log("自动补录剧情回顾: intro_scene");
        }

        // 2. 如果玩家发现过第一本书，补录 find_first_note
        // (判断依据可以是 hasFoundMysteryEntry 或者 inventory 里有相关道具，这里假设用 hasFoundMysteryEntry 标记)
        if (this.state.hasFoundMysteryEntry && !this.state.unlockedScripts.includes('find_first_note')) {
            this.state.unlockedScripts.push('find_first_note');
            console.log("自动补录剧情回顾: find_first_note");
        }
        
        // 保存一下迁移后的数据
        this.save();
        
        // 新手礼包/房间重置检测
        if (!this.state.layout) {
            console.log("检测到新用户/重置状态，发放新手礼包...");
            this.state.layout = []; 
            const starterPack = ['item_desk_default', 'item_bookshelf_default', 'item_rug_default', 'item_chair_default', 'item_bed_default','item_shelf_default'];
            starterPack.forEach(id => {
                if (!this.state.inventory.includes(id)) this.state.inventory.push(id);
            });
            this.save();
        }

        if (typeof this.state.ink === 'undefined') this.state.ink = 0;
        if (typeof this.state.totalWords === 'undefined') this.state.totalWords = 0;
        if (!this.state.fragments) this.state.fragments = [];
        
        // --- 2. ✨ 手记本系统初始化 ---
        // 如果没有 notebook 数据（旧存档或新用户），初始化一个默认的“日常碎片”
        if (!this.state.notebooks || !Array.isArray(this.state.notebooks) || this.state.notebooks.length === 0) {
            console.log("初始化默认手记本...");
            this.state.notebooks = [
                { 
                    id: 'nb_inbox', 
                    name: '日常碎片', 
                    // ✨ 使用上传的软木板素材作为图标
                    icon: 'assets/images/booksheet/notebook.png', 
                    isDefault: true, 
                    createdAt: Date.now() 
                }
            ];
            this.save();
        }

        // --- 3. 旧存档迁移逻辑 (字数统计) ---
        if (this.state.totalWords === 0) {
             let allEntries = Journal.getAll();
             if (allEntries.length === 0) {
                await Journal.init();
                allEntries = Journal.getAll();
             }
             let needSave = false;
             allEntries.forEach(entry => {
                if (entry.isConfirmed && typeof entry.savedWordCount === 'undefined') {
                    const count = (entry.content || "").replace(/\s/g, '').length;
                    this.state.totalWords += count;
                    entry.savedWordCount = count;
                    needSave = true;
                }
             });
             if(needSave) {
                 this.save();
                 Journal.save();
             }
        }
    },

    // ✨ 新增：信箱相关方法
    hasReadMail(day) {
        if (!this.state.readMails) this.state.readMails = [];
        return this.state.readMails.includes(day);
    },

    markMailAsRead(day) {
        if (!this.state.readMails) this.state.readMails = [];
        if (!this.hasReadMail(day)) {
            this.state.readMails.push(day);
            this.save();
            
            // ✨ [修复] 检查是否阅读了10封信
            // 注意：如果还有其他NPC的信件，这里可能需要过滤 ID，
            // 但如果只有糖水菠萝的信，直接判断长度即可。
            if (this.state.readMails.length >= 10) {
                this.unlockAchievement('ach_pineapple');
            }
        }
    },

    // ✨ 新增方法：保存回复
    saveMailReply(day, content) {
        if (!this.state.mailReplies) this.state.mailReplies = {};
        this.state.mailReplies[day] = content;
        this.save();
    },

    // ✨ 修复：补充缺失的 getReply 方法
    getReply(day) {
        if (!this.state.mailReplies) return null;
        return this.state.mailReplies[day] || null;
    },

    // ✨ 新增方法：获取所有回复（用于生成书）
    getAllReplies() {
        return this.state.mailReplies || {};
    },

    // ============================================================
    // ✨ 核心新增：手记本 (Notebook) 管理
    // ============================================================

    // 1. 创建新本子 (支持传入 parentId 成为子手记本)
    createNotebook(name, parentId = null) {
        const newNotebook = {
            id: 'nb_' + Date.now(),
            name: name || '未命名手记',
            icon: 'assets/images/booksheet/notebook.png', 
            createdAt: Date.now(),
            isDefault: false,
            parentId: parentId // ✨ 新增：记录父级ID
        };
        this.state.notebooks.push(newNotebook);
        this.save();
        return newNotebook;
    },

    // 2. 重命名本子
    renameNotebook(id, newName) {
        const nb = this.state.notebooks.find(n => n.id === id);
        if (nb) {
            nb.name = newName;
            this.save();
            return true;
        }
        return false;
    },

    // 3. 删除本子
    deleteNotebook(id) {
        // 保护默认收件箱不被删除
        if (id === 'nb_inbox') return false;
        
        const index = this.state.notebooks.findIndex(n => n.id === id);
        if (index !== -1) {
            // ✨ 新增保护机制：如果被删除的是父文件夹，把它的子文件夹移出到根目录，防止子文件夹跟着丢失
            this.state.notebooks.forEach(n => {
                if (n.parentId === id) {
                    n.parentId = null; 
                }
            });

            this.state.notebooks.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    },

    // 4. 🌟 新增：移动手记本 (支持拖拽层级)
    moveNotebook(id, newParentId) {
        if (id === newParentId) return false; // 不能移动到自己内部
        
        const nb = this.state.notebooks.find(n => n.id === id);
        if (nb) {
            nb.parentId = newParentId;
            this.save();
            return true;
        }
        return false;
    },

    // 🌟 新增：移动并排序手记本 (支持同级排序和嵌套)
    reorderNotebook(draggedId, targetId, position) {
        if (draggedId === targetId) return false;

        const draggedIndex = this.state.notebooks.findIndex(n => n.id === draggedId);
        const targetIndex = this.state.notebooks.findIndex(n => n.id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) return false;

        const draggedItem = this.state.notebooks[draggedIndex];
        const targetItem = this.state.notebooks[targetIndex];

        // 1. 先把被拖拽的元素从原位置抽出
        this.state.notebooks.splice(draggedIndex, 1);

        // 2. 重新获取目标元素的最新索引 (因为上一步 splice 可能会让索引减 1)
        const newTargetIndex = this.state.notebooks.findIndex(n => n.id === targetId);

        // 3. 根据鼠标释放的位置进行插入
        if (position === 'inside') {
            // 嵌套为子目录
            draggedItem.parentId = targetId;
            // 塞在父目录后面的位置，渲染时会自然跟在它下面
            this.state.notebooks.splice(newTargetIndex + 1, 0, draggedItem);
        } else {
            // 平级移动：继承目标文件夹的层级 (都在外层，或都在同一个父文件夹里)
            draggedItem.parentId = targetItem.parentId;
            
            if (position === 'before') {
                this.state.notebooks.splice(newTargetIndex, 0, draggedItem);
            } else if (position === 'after') {
                this.state.notebooks.splice(newTargetIndex + 1, 0, draggedItem);
            }
        }
        
        this.save();
        return true;
    },

    // 🌟 新增：获取某个手记本的所有子手记本ID (用于防止循环嵌套)
    getAllDescendantIds(parentId) {
        let descendants = [];
        const children = this.state.notebooks.filter(n => n.parentId === parentId);
        children.forEach(child => {
            descendants.push(child.id);
            descendants = descendants.concat(this.getAllDescendantIds(child.id));
        });
        return descendants;
    },

    // 5. 获取本子信息
    getNotebook(id) {
        return this.state.notebooks.find(n => n.id === id) || null;
    },

    // ============================================================
    // 碎片与字数 (Fragments & Stats)
    // ============================================================

    addFragment(fragmentId) {
        if (!this.state.fragments.includes(fragmentId)) {
            this.state.fragments.push(fragmentId);
            this.save();
            return true; 
        }
        return false;
    },

    hasFragment(fragmentId) {
        return this.state.fragments.includes(fragmentId);
    },

    updateWordCount(delta) {
        if (delta === 0) return;
        if (typeof this.state.totalWords === 'undefined') this.state.totalWords = 0;
        
        this.state.totalWords += delta;
        if (this.state.totalWords < 0) this.state.totalWords = 0;
        
        this.save();
        console.log(`[UserData] 字数变更: ${delta} -> 总计: ${this.state.totalWords}`);

        // ✨ 新增逻辑：字数成就检测
        // 因为 unlockAchievement 内部有去重判断，所以这里可以直接调用
        if (this.state.totalWords >= 1000) this.unlockAchievement('ach_word_1k');
        if (this.state.totalWords >= 5000) this.unlockAchievement('ach_word_5k');
        if (this.state.totalWords >= 10000) this.unlockAchievement('ach_word_10k');
    },

    save() {
        window.ithacaSystem.saveData('user_data.json', JSON.stringify(this.state));
    },

    // ============================================================
    // 基础资源管理 (Ink & Time)
    // ============================================================

    addInk(amount) {
        this.state.ink += amount;
        this.save();
    },

    consumeInk(amount) {
        if (this.state.ink >= amount) {
            this.state.ink -= amount;
            this.save();
            return true;
        }
        return false;
    },

    nextDay() {
        this.state.day++;
        this.save();
    },

    // ============================================================
    // 背包系统 (Inventory)
    // ============================================================

    addItem(itemId) {
        if (!this.state.inventory.includes(itemId)) {
            this.state.inventory.push(itemId);
            this.save();
        }
    },

    hasItem(itemId) {
        return this.state.inventory.includes(itemId);
    },

    // ============================================================
    // 装修/布局系统 (Layout)
    // ============================================================

    // 1. 放置新家具
    placeFurniture(itemId, x, y, direction = 1) {
        const newItem = {
            uid: Date.now() + Math.floor(Math.random() * 1000),
            itemId: itemId,
            x: x,
            y: y,
            direction: direction 
        };
        this.state.layout.push(newItem);
        this.save();
        return newItem;
    },

    // 2. 更新已有家具
    updateFurniture(uid, x, y, direction = 1) {
        const item = this.state.layout.find(i => i.uid === uid);
        if (item) {
            item.x = x;
            item.y = y;
            item.direction = direction;
            this.save();
        }
    },

    // 3. 移除家具 (从房间 -> 收回背包)
    removeFurniture(uid) {
        this.state.layout = this.state.layout.filter(i => i.uid !== uid);
        this.save();
    },


    // ============================================================
    // 成就系统 (Achievements)
    // ============================================================
    unlockAchievement(achId) {
        // 如果存档里没有这个字段，先初始化
        if (!this.state.achievements) this.state.achievements = [];

        // 如果已经解锁过，直接返回
        if (this.state.achievements.includes(achId)) return false;

        // 解锁逻辑
        this.state.achievements.push(achId);
        this.save();
        
        console.log(`🏆 成就解锁: ${ACHIEVEMENTS[achId].title}`);
        
        // 触发 UI 通知 (由于 UserData 是纯数据层，我们通过自定义事件通知 UI)
        // 或者直接调用全局 UI 渲染器 (如果在 app.js 里挂载了)
        // 这里推荐使用事件总线，但为了简单，假设 window.ithacaUI 全局可用，或者通过事件分发
        const event = new CustomEvent('achievement-unlocked', { detail: achId });
        window.dispatchEvent(event);
        
        return true;
    },
    
    // 检查是否拥有某成就
    hasAchievement(achId) {
        return this.state.achievements && this.state.achievements.includes(achId);
    },

    // ============================================================
    // 剧情回顾 (Scripts Review)
    // ============================================================
    unlockScript(scriptId) {
    if (!this.state.unlockedScripts) this.state.unlockedScripts = [];
        if (!this.state.unlockedScripts.includes(scriptId)) {
            this.state.unlockedScripts.push(scriptId);
            this.save();
        }
    }
};