/* src/js/data/Journal.js */
import { UserData } from './UserData.js';
import { FragmentSystem } from '../logic/FragmentSystem.js';

export const Journal = {
    entries: [], 

    // 初始化：从本地文件加载数据
    async init() {
        const saved = await window.ithacaSystem.loadData('journal_data.json');
        if (saved) {
            try {
                this.entries = JSON.parse(saved);
            } catch (e) {
                console.error("Journal data parse error", e);
                this.entries = [];
            }
        }
        
        // 兼容性处理：把旧的单字段 notebookId 迁移到 notebookIds 数组
        this.entries.forEach(entry => {
            if (!entry.notebookIds) {
                entry.notebookIds = [];
                // 如果有旧的归属，迁移过来；否则保持为空（归入默认收件箱）
                if (entry.notebookId) {
                    entry.notebookIds.push(entry.notebookId);
                }
            }
            // ✨ 融合：确保 isDeleted 字段存在
            if (entry.isDeleted === undefined) {
                entry.isDeleted = false;
            }
        });

        // 如果完全没有日记（第一次运行），默认建一篇
        if (this.entries.length === 0) {
            this.createNewEntry();
        }
    },

    // 新建日记逻辑 (保留你的原有逻辑)
    createNewEntry() {
        const now = new Date();
        const dateStr = now.toLocaleDateString(); 
        const timeStr = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        const newEntry = {
            id: Date.now(),
            // 🛡️ 核心逻辑保留：记录日记属于哪一天
            day: UserData.state.day || 1, 
            
            date: dateStr,
            time: timeStr,
            content: "", 
            isConfirmed: false,
            savedWordCount: 0,
            notebookIds: [],
            isDeleted: false // ✨ 新增初始化
        };
        
        this.entries.unshift(newEntry); 
        this.save();
        return newEntry;
    },

    // 切换归属状态 (保留你的原有逻辑)
    toggleNotebook(entryId, notebookId) {
        const entry = this.entries.find(e => e.id === entryId);
        if (!entry) return;

        if (!entry.notebookIds) entry.notebookIds = [];

        const index = entry.notebookIds.indexOf(notebookId);
        if (index > -1) {
            entry.notebookIds.splice(index, 1);
        } else {
            entry.notebookIds.push(notebookId);
        }
        this.save();
    },

    // 更新日记内容 (保留你的原有逻辑：含字数统计)
    updateEntry(id, content) {
        const entry = this.entries.find(e => e.id === id);
        if (entry) {
            entry.content = content;

            // 如果是"已确认"的日记，需要实时同步字数变化
            if (entry.isConfirmed) {
                const newCount = this._countWords(content);
                const oldCount = entry.savedWordCount || 0; 
                const diff = newCount - oldCount;

                // 只有字数发生实际变化时才更新 UserData
                if (diff !== 0) {
                    UserData.updateWordCount(diff);
                    entry.savedWordCount = newCount;
                    
                    if (diff > 0) {
                        FragmentSystem.checkWordCountMilestones();
                    }
                }
            }

            this.save();
        }
    },

    // 确认日记 (保留你的原有逻辑)
    confirmEntry(id) {
        // 🛡️ 核心修复保留：使用 == 防止类型不匹配
        const entry = this.entries.find(e => e.id == id);
        
        if (entry && !entry.isConfirmed) {
            entry.isConfirmed = true;

            const currentCount = this._countWords(entry.content);
            entry.savedWordCount = currentCount;
            
            if (currentCount > 0) {
                UserData.updateWordCount(currentCount);
                FragmentSystem.checkWordCountMilestones();
            }

            this.save();
            return true;
        }
        return false;
    },

    // ==========================================
    // ✨ 修改：删除逻辑改为“软删除”
    // ==========================================
    deleteEntry(id) {
        const entry = this.entries.find(e => e.id == id); // 使用 == 兼容
        if (entry) {
            entry.isDeleted = true;
            entry.deletedAt = Date.now();
            // 注意：软删除时不扣字数，因为还在回收站里，可以恢复。
            // 如果你希望进回收站就扣字数，可以在这里加逻辑，但在 restore 时要加回来。
            // 建议：彻底焚毁时再扣。
            this.save();
            return true;
        }
        return false;
    },

    // ✨ 新增：还原日记
    restoreEntry(id) {
        const entry = this.entries.find(e => e.id == id);
        if (entry) {
            entry.isDeleted = false;
            delete entry.deletedAt;
            this.save();
            return true;
        }
        return false;
    },

    // ✨ 新增：彻底焚毁 (物理删除)
    hardDeleteEntry(id) {
        const index = this.entries.findIndex(e => e.id == id);
        if (index !== -1) {
            const entry = this.entries[index];

            // 🛡️ 核心逻辑保留：防刷分逻辑
            // 只有在彻底删除时，才真正扣除它贡献的字数
            if (entry.isConfirmed) {
                const countToRemove = entry.savedWordCount || this._countWords(entry.content);
                if (countToRemove > 0) {
                    UserData.updateWordCount(-countToRemove); 
                }
            }

            this.entries.splice(index, 1); 
            this.save();
            return true;
        }
        return false;
    },    

    // 获取所有【未删除】的日记
    getAll() {
        return this.entries.filter(e => !e.isDeleted);
    },

    // ✨ 新增：获取【回收站】里的日记
    getTrash() {
        return this.entries.filter(e => e.isDeleted).sort((a, b) => {
            const timeA = a.deletedAt || a.id;
            const timeB = b.deletedAt || b.id;
            return timeB - timeA;
        });
    },

    // 重置日记本 (保留你的原有逻辑)
    reset() {
        this.entries = [];
        this.save();
        console.log("📝 日记已清空");
    },

    // 保存 (保留你的原有逻辑)
    save() {
        if (window.ithacaSystem && window.ithacaSystem.saveData) {
            window.ithacaSystem.saveData('journal_data.json', JSON.stringify(this.entries));
        } else {
            console.warn("Save failed: window.ithacaSystem not found");
        }
    },

    // --- 内部工具 ---
    _countWords(text) {
        if (!text) return 0;
        return text.replace(/\s/g, '').length;
    }
};