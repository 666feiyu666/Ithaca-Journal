/* src/js/data/Journal.js */
import { UserData } from './UserData.js';

export const Journal = {
    entries: [],

    init() {
        this.load();
        // 数据迁移：确保所有日记都有 isDeleted 字段
        let hasChanges = false;
        this.entries.forEach(e => {
            if (e.isDeleted === undefined) {
                e.isDeleted = false;
                hasChanges = true;
            }
        });
        if(hasChanges) this.save();
    },

    load() {
        const data = localStorage.getItem('ithaca_journal_entries');
        if (data) {
            this.entries = JSON.parse(data);
        }
    },

    save() {
        localStorage.setItem('ithaca_journal_entries', JSON.stringify(this.entries));
        
        // 同时更新 UserData 中的字数统计 (只统计未删除的)
        // 注意：这里我们简单处理，总字数只增不减（成就系统），或者根据需求实时计算。
        // 为了简单起见，这里只负责保存数据。
    },

    /**
     * 获取所有【未删除】的日记
     */
    getAll() {
        return this.entries.filter(e => !e.isDeleted).sort((a, b) => {
            // 先按日期倒序
            if (a.date !== b.date) return a.date > b.date ? -1 : 1;
            // 同一天按时间戳倒序
            return b.timestamp - a.timestamp;
        });
    },

    /**
     * ✨ 新增：获取所有【废纸篓】里的日记
     */
    getTrash() {
        return this.entries.filter(e => e.isDeleted).sort((a, b) => {
            // 按删除时间倒序，如果没有删除时间，就按创建时间
            const timeA = a.deletedAt || a.timestamp;
            const timeB = b.deletedAt || b.timestamp;
            return timeB - timeA;
        });
    },

    createNewEntry() {
        const now = new Date();
        const entry = {
            id: 'entry_' + Date.now(),
            date: now.toLocaleDateString(), 
            time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            timestamp: Date.now(),
            content: "",
            notebookIds: [], // 所属手记本ID列表
            tags: [],
            isConfirmed: false,
            isDeleted: false // 默认为未删除
        };
        this.entries.unshift(entry);
        this.save();
        return entry;
    },

    updateEntry(id, content) {
        const entry = this.entries.find(e => e.id === id);
        if (entry) {
            // 计算字数增量
            const oldLen = entry.content ? entry.content.length : 0;
            const newLen = content.length;
            const diff = newLen - oldLen;

            entry.content = content;
            this.save();

            // 更新用户总字数
            if (diff !== 0) {
                UserData.addWords(diff);
            }
        }
    },

    confirmEntry(id) {
        const entry = this.entries.find(e => e.id === id);
        if (entry && !entry.isConfirmed) {
            entry.isConfirmed = true;
            this.save();
            return true;
        }
        return false;
    },

    toggleNotebook(entryId, notebookId) {
        const entry = this.entries.find(e => e.id === entryId);
        if (!entry) return;

        if (!entry.notebookIds) entry.notebookIds = [];

        if (entry.notebookIds.includes(notebookId)) {
            entry.notebookIds = entry.notebookIds.filter(id => id !== notebookId);
        } else {
            entry.notebookIds.push(notebookId);
        }
        this.save();
    },

    // ==========================================
    // ✨ 修改：删除逻辑改为“移入回收站”
    // ==========================================
    deleteEntry(id) {
        const entry = this.entries.find(e => e.id === id);
        if (entry) {
            entry.isDeleted = true;
            entry.deletedAt = Date.now(); // 记录删除时间
            this.save();
            return true;
        }
        return false;
    },

    /**
     * ✨ 新增：还原日记
     */
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

    /**
     * ✨ 新增：彻底删除 (物理删除)
     */
    hardDeleteEntry(id) {
        const index = this.entries.findIndex(e => e.id === id);
        if (index !== -1) {
            this.entries.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    }
};