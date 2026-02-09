/* src/js/data/Journal.js */
import { UserData } from './UserData.js';
import { StoryManager } from '../logic/StoryManager.js';

export const Journal = {
    entries: [],

    async init() {
        await this.load();
        
        // 数据迁移与修复
        let hasChanges = false;
        this.entries.forEach(e => {
            if (e.isDeleted === undefined) {
                e.isDeleted = false;
                hasChanges = true;
            }
            if (!e.notebookIds) {
                e.notebookIds = [];
                hasChanges = true;
            }
        });
        if(hasChanges) this.save();
    },

    async load() {
        // ✨ 优先尝试系统读取，保持与 UserData 一致
        if (window.ithacaSystem && window.ithacaSystem.loadData) {
            const data = await window.ithacaSystem.loadData('journal_data.json');
            if (data) this.entries = JSON.parse(data);
        } else {
            // 降级兼容 localStorage
            const data = localStorage.getItem('ithaca_journal_entries');
            if (data) this.entries = JSON.parse(data);
        }
    },

    save() {
        const json = JSON.stringify(this.entries);
        if (window.ithacaSystem && window.ithacaSystem.saveData) {
            window.ithacaSystem.saveData('journal_data.json', json);
        } else {
            localStorage.setItem('ithaca_journal_entries', json);
        }
    },

    getAll() {
        return this.entries.filter(e => !e.isDeleted).sort((a, b) => {
            // 按创建时间倒序（最新在最前）
            return (b.createdAt || b.timestamp || 0) - (a.createdAt || a.timestamp || 0);
        });
    },

    getTrash() {
        return this.entries.filter(e => e.isDeleted).sort((a, b) => {
            return (b.deletedAt || 0) - (a.deletedAt || 0);
        });
    },

    createNewEntry() {
        // 移除对 UserData.state.day 的依赖
        const now = new Date();
        // 获取本地格式化的系统日期，例如 "2026/1/17"
        const dateString = now.toLocaleDateString(); 
        
        const entry = {
            id: 'entry_' + Date.now(),
            date: dateString, // ✨ 修改此处：由 "Day X" 改为系统日期
            time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            timestamp: Date.now(),
            createdAt: Date.now(),
            content: "",
            notebookIds: [], 
            tags: [],
            isConfirmed: false,
            isDeleted: false,
            savedWordCount: 0 
        };
        
        this.entries.unshift(entry);
        this.save();
        return entry;
    },

    updateEntry(id, content) {
        const entry = this.entries.find(e => e.id === id);
        if (entry) {
            entry.content = content;
            
            // ✨ 修复：只有在日记【已确认/归档】后，输入才会计入生涯总字数
            // 如果你希望实时计入，请保留下方逻辑，但要注意 UserData 方法名
            if (entry.isConfirmed) {
                const currentCount = (content || "").replace(/\s/g, '').length;
                const lastCount = entry.savedWordCount || 0;
                const diff = currentCount - lastCount;
                
                if (diff !== 0) {
                    // ✅ 修复：调用 updateWordCount 而不是 addWords
                    UserData.updateWordCount(diff);
                    entry.savedWordCount = currentCount;
                }
            }
            
            this.save();
        }
    },

    confirmEntry(id) {
        const entry = this.entries.find(e => e.id === id);
        if (entry && !entry.isConfirmed) {
            entry.isConfirmed = true;
            
            // 确认时，结算字数
            const wordCount = (entry.content || "").replace(/\s/g, '').length;
            entry.savedWordCount = wordCount;
            // ✅ 修复：调用 updateWordCount
            UserData.updateWordCount(wordCount);
            UserData.unlockAchievement('ach_diary'); // 尝试解锁成就

            this.save();
            return true;
        }
        return false;
    },

    toggleNotebook(entryId, notebookId) {
        const entry = this.entries.find(e => e.id === entryId);
        if (!entry) return;

        if (!entry.notebookIds) entry.notebookIds = [];

        const idx = entry.notebookIds.indexOf(notebookId);
        if (idx > -1) {
            entry.notebookIds.splice(idx, 1);
        } else {
            entry.notebookIds.push(notebookId);
        }
        this.save();
    },

    deleteEntry(id) {
        const entry = this.entries.find(e => e.id === id);
        if (entry) {
            entry.isDeleted = true;
            entry.deletedAt = Date.now();
            this.save();
            return true;
        }
        return false;
    },

    restoreEntry(id) {
        const entry = this.entries.find(e => e.id === id);
        if (entry) {
            entry.isDeleted = false;
            delete entry.deletedAt;
            this.save();
            return true;
        }
        return false;
    },

    hardDeleteEntry(id) {
        const index = this.entries.findIndex(e => e.id === id);
        if (index !== -1) {
            const entry = this.entries[index];
            // 如果已确认，扣除字数
            if (entry.isConfirmed && entry.savedWordCount > 0) {
                UserData.updateWordCount(-entry.savedWordCount);
            }
            this.entries.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    },

    // ✨ 新增：导入旧版日记功能
    async importFromLegacy() {
        // 1. 调用后端接口选择文件
        const result = await window.ithacaSystem.importData();
        
        if (!result.success) return; // 用户取消或出错

        try {
            const oldEntries = JSON.parse(result.data);

            if (!Array.isArray(oldEntries)) {
                alert("文件格式错误：请选择 journal_data.json");
                return;
            }

            let importCount = 0;
            
            // 2. 遍历旧日记，进行“去重合并”
            oldEntries.forEach(oldEntry => {
                // 检查当前日记列表里是否已经有这个 ID
                const exists = this.entries.some(current => current.id === oldEntry.id);
                
                // 如果没有，才添加进来
                if (!exists) {
                    // 兼容性处理：如果旧数据缺字段，可以在这里补全
                    if (!oldEntry.notebookIds) oldEntry.notebookIds = [];
                    
                    this.entries.push(oldEntry);
                    importCount++;
                }
            });

            if (importCount > 0) {
                // 3. 重新排序：按时间倒序
                this.entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                
                // 4. 保存并刷新
                this.save();
                alert(`成功导入 ${importCount} 篇旧日记！页面即将刷新。`);
                window.location.reload(); // 刷新页面以显示新数据
            } else {
                alert("没有发现新日记，数据可能已存在。");
            }

        } catch (e) {
            console.error(e);
            alert("导入失败：数据解析错误");
        }
    }
};