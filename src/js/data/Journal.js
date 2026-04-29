/* src/js/data/Journal.js */
import { UserData } from './UserData.js';

function cloneEntries(entries) {
    return JSON.parse(JSON.stringify(entries));
}

function normalizeEntry(entry) {
    const normalized = { ...entry };
    if (typeof normalized.id !== 'string') normalized.id = String(normalized.id);
    if (normalized.isDeleted === undefined) normalized.isDeleted = false;
    if (!Array.isArray(normalized.notebookIds)) normalized.notebookIds = [];
    if (!Array.isArray(normalized.tags)) normalized.tags = [];

    if (normalized.notebookId !== undefined) {
        if (normalized.notebookId && !normalized.notebookIds.includes(normalized.notebookId)) {
            normalized.notebookIds.push(normalized.notebookId);
        }
        delete normalized.notebookId;
    }

    if (normalized.isConfirmed === undefined) normalized.isConfirmed = false;
    if (typeof normalized.savedWordCount === 'undefined') normalized.savedWordCount = 0;
    return normalized;
}

export const Journal = {
    entries: [],

    async init() {
        await this.load();
        
        let hasChanges = false;
        this.entries.forEach((e, index) => {
            const normalized = normalizeEntry(e);
            if (JSON.stringify(normalized) !== JSON.stringify(e)) {
                this.entries[index] = normalized;
                hasChanges = true;
            }
        });
        
        if(hasChanges) this.save();
    },

    async load() {
        if (window.ithacaSystem && window.ithacaSystem.loadData) {
            const data = await window.ithacaSystem.loadData('journal_data.json');
            if (data) {
                try {
                    this.entries = JSON.parse(data);
                } catch (err) {
                    console.error('日记存档解析失败，回退为空列表:', err);
                    this.entries = [];
                }
            }
        } else {
            const data = localStorage.getItem('ithaca_journal_entries');
            if (data) this.entries = JSON.parse(data);
        }
    },

    save() {
        const json = JSON.stringify(this.entries);
        if (window.ithacaSystem && window.ithacaSystem.saveData) {
            return window.ithacaSystem.saveData('journal_data.json', json);
        } else {
            localStorage.setItem('ithaca_journal_entries', json);
        }
    },

    getExportData() {
        return cloneEntries(this.entries);
    },

    replaceEntries(entries, { save = true } = {}) {
        this.entries = Array.isArray(entries) ? cloneEntries(entries).map(normalizeEntry) : [];
        if (save) this.save();
        return this.entries;
    },

    getAll() {
        return this.entries.filter(e => !e.isDeleted);
    },

    getTrash() {
        return this.entries.filter(e => e.isDeleted).sort((a, b) => {
            return (b.deletedAt || 0) - (a.deletedAt || 0);
        });
    },

    createNewEntry() {
        const now = new Date();
        const dateString = now.toLocaleDateString(); 
        
        const entry = {
            id: 'entry_' + Date.now(),
            date: dateString,
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
        const entry = this.entries.find(e => String(e.id) === String(id));
        if (entry) {
            entry.content = content;
            
            const matches = content.match(/[#＃]([^\s#\.,?!，。？！\n\r]+)/g) || [];
            entry.tags = [...new Set(matches.map(t => t.substring(1)))];
            
            if (entry.isConfirmed) {
                const currentCount = (content || "").replace(/\s/g, '').length;
                const lastCount = entry.savedWordCount || 0;
                const diff = currentCount - lastCount;
                
                if (diff !== 0) {
                    UserData.updateWordCount(diff);
                    entry.savedWordCount = currentCount;
                }
            }
            
            this.save();
        }
    },

    getAllTags() {
        const tagSet = new Set();
        this.getAll().forEach(e => {
            if (e.tags && Array.isArray(e.tags)) {
                e.tags.forEach(t => tagSet.add(t));
            }
        });
        return Array.from(tagSet);
    },

    confirmEntry(id) {
        const entry = this.entries.find(e => String(e.id) === String(id));
        if (entry && !entry.isConfirmed) {
            entry.isConfirmed = true;
            const wordCount = (entry.content || "").replace(/\s/g, '').length;
            entry.savedWordCount = wordCount;
            UserData.updateWordCount(wordCount);
            UserData.unlockAchievement('ach_diary');
            this.save();
            return true;
        }
        return false;
    },

    toggleNotebook(entryId, notebookId) {
        const entry = this.entries.find(e => String(e.id) === String(entryId));
        if (!entry) return;
        if (!entry.notebookIds) entry.notebookIds = [];

        // 🌟 核心修改1：取消原本的“日常碎片”叠加逻辑，改为完全互斥。
        const idx = entry.notebookIds.indexOf(notebookId);
        if (idx > -1) {
            // 如果再次点击它所在的目录，取消归档，变成游离状态（所有记忆）
            entry.notebookIds = []; 
        } else {
            // 只要放入目录，就斩断它与其他目录（包括日常碎片）的所有联系
            entry.notebookIds = [notebookId];
        }
        
        this.save();
    },

    moveToNotebook(entryId, notebookId) {
        const entry = this.entries.find(e => String(e.id) === String(entryId));
        if (!entry) return false;
        
        if (!entry.notebookIds) entry.notebookIds = [];
        
        if (notebookId === 'TRASH_BIN_ID') return this.deleteEntry(entryId);

        // 🌟 核心修改2：取消 isDaily 判断，执行强制转移
        if (notebookId === 'REPO_ALL_ID' || notebookId === 'INBOX_VIRTUAL_ID') {
            entry.notebookIds = []; // 回到大厅
        } else {
            // 不管是从哪里拖过来的，放进新目录就只属于这个新目录
            entry.notebookIds = [notebookId]; 
        }
        
        this.save();
        return true;
    },

    reorderEntry(draggedEntryId, targetEntryId) {
        const dragIndex = this.entries.findIndex(e => String(e.id) === String(draggedEntryId));
        const targetIndex = this.entries.findIndex(e => String(e.id) === String(targetEntryId));

        if (dragIndex > -1 && targetIndex > -1 && dragIndex !== targetIndex) {
            const [draggedItem] = this.entries.splice(dragIndex, 1);
            this.entries.splice(targetIndex, 0, draggedItem);
            this.save();
            return true;
        }
        return false;
    },
    
    deleteEntry(id) {
        const entry = this.entries.find(e => String(e.id) === String(id));
        if (entry) {
            entry.isDeleted = true;
            entry.deletedAt = Date.now();
            this.save();
            return true;
        }
        return false;
    },

    restoreEntry(id) {
        const entry = this.entries.find(e => String(e.id) === String(id));
        if (entry) {
            entry.isDeleted = false;
            delete entry.deletedAt;
            this.save();
            return true;
        }
        return false;
    },

    hardDeleteEntry(id) {
        const index = this.entries.findIndex(e => String(e.id) === String(id));
        if (index !== -1) {
            const entry = this.entries[index];
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
        if (!Array.isArray(importedEntries)) return alert("导入失败：文件格式不正确");

        let importCount = 0;
        let addedWords = 0;

        importedEntries.forEach(newEntry => {
            const exists = this.entries.some(current => String(current.id) === String(newEntry.id));
            if (!exists) {
                const normalized = normalizeEntry(newEntry);
                this.entries.push(normalized);
                importCount++;

                if (normalized.isConfirmed) {
                    const count = normalized.savedWordCount || (normalized.content || "").replace(/\s/g, '').length;
                    normalized.savedWordCount = count;
                    addedWords += count;
                }
            }
        });

        if (importCount > 0) {
            this.entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            if (addedWords > 0) UserData.updateWordCount(addedWords);
            this.save();
            alert(`成功导入 ${importCount} 篇日记！`);
        } else {
            alert("未发现新的日记数据。");
        }
    }
};
