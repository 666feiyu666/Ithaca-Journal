/* src/js/data/Journal.js */
import { UserData } from './UserData.js';

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

        // 🌟 核心修改：将“标签多选”模式改为“文件夹唯一归属”模式
        if (notebookId === 'nb_daily') {
            // “日常碎片”依然可以作为一个特殊的平行状态叠加
            const idx = entry.notebookIds.indexOf(notebookId);
            if (idx > -1) {
                entry.notebookIds.splice(idx, 1);
            } else {
                entry.notebookIds.push(notebookId);
            }
        } else {
            // 对于自定义的层级手记本：只能属于一个！排他性覆盖！
            const idx = entry.notebookIds.indexOf(notebookId);
            if (idx > -1) {
                // 如果再次点击已归档的目录，则取消归档（移出到最外层）
                entry.notebookIds = entry.notebookIds.filter(id => id === 'nb_daily'); 
            } else {
                // 如果是归档到新目录，直接清除其他所有自定义目录的关联！
                const isDaily = entry.notebookIds.includes('nb_daily');
                entry.notebookIds = isDaily ? ['nb_daily', notebookId] : [notebookId];
            }
        }
        this.save();
    },

    // 🌟 替换上一次骤写的 moveEntry 方法
    moveEntry(id, sourceNotebookId, targetNotebookId) {
        const entry = this.entries.find(e => e.id === id);
        if (!entry) return false;
        if (!entry.notebookIds) entry.notebookIds = [];

        // 如果拖入废纸篓，直接执行删除逻辑
        if (targetNotebookId === 'TRASH_BIN_ID') {
            return this.deleteEntry(id);
        }

        const isDaily = entry.notebookIds.includes('nb_daily');

        if (targetNotebookId === 'REPO_ALL_ID') {
            // 拖回“所有记忆”大厅：清空所属文件夹（移出子目录）
            entry.notebookIds = isDaily ? ['nb_daily'] : [];
        } else if (targetNotebookId === 'nb_daily') {
            // 拖入日常碎片
            if (!isDaily) entry.notebookIds.push('nb_daily');
        } else {
            // 🌟 核心修改：强制覆盖！彻底切断与原文件夹的联系，变成绝对的“物理移动”
            entry.notebookIds = isDaily ? ['nb_daily', targetNotebookId] : [targetNotebookId];
        }

        this.save();
        return true;
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

    async importData(importedEntries) {
        if (!Array.isArray(importedEntries)) {
            alert("导入失败：文件格式不正确，需要是数组格式的 journal_data.json");
            return;
        }

        let importCount = 0;
        let addedWords = 0;

        // 遍历导入的日记，避免 ID 重复
        importedEntries.forEach(newEntry => {
            // 检查 ID 是否已存在
            const exists = this.entries.some(current => String(current.id) === String(newEntry.id));
            
            if (!exists) {
                // 补全缺失字段
                if (!newEntry.notebookIds) newEntry.notebookIds = [];
                if (newEntry.isConfirmed === undefined) newEntry.isConfirmed = true; 

                this.entries.push(newEntry);
                importCount++;

                // 如果是已确认的日记，补加字数
                if (newEntry.isConfirmed) {
                    const count = newEntry.savedWordCount || (newEntry.content || "").replace(/\s/g, '').length;
                    newEntry.savedWordCount = count;
                    addedWords += count;
                }
            }
        });

        if (importCount > 0) {
            // 重新排序：按时间倒序
            this.entries.sort((a, b) => {
                const tA = a.timestamp || 0;
                const tB = b.timestamp || 0;
                return tB - tA;
            });

            // 更新总字数
            if (addedWords > 0) UserData.updateWordCount(addedWords);
            
            // 保存并刷新
            this.save();
            alert(`成功导入 ${importCount} 篇日记！`);
            
            // 如果需要刷新界面，可以在这里调用，或者由 UI 层决定
            // location.reload(); 
        } else {
            alert("未发现新的日记数据。");
        }
    },
};