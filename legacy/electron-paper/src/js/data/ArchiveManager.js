/* src/js/data/ArchiveManager.js */
import { UserData } from './UserData.js';
import { Journal } from './Journal.js';
import { Library } from './Library.js';

const ARCHIVE_FORMAT = 'ithaca-journal-archive';
const ARCHIVE_SCHEMA_VERSION = 2;
const WAITING_JOURNAL_HANDOFF_VERSION = 1;

function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
}

function buildSummary() {
    const allEntries = Journal.getAll();
    const activeBooks = Library.getAll();
    return {
        currentDay: UserData.state.day || 1,
        totalWords: UserData.state.totalWords || 0,
        journalEntryCount: allEntries.length,
        deletedJournalEntryCount: Journal.getTrash().length,
        bookCount: activeBooks.length,
        deletedBookCount: Library.getTrash().length,
        notebookCount: (UserData.state.notebooks || []).length
    };
}

function buildWaitingJournalHandoff() {
    const userData = UserData.getExportData();
    const journalEntries = Journal.getExportData();
    const libraryBooks = Library.getExportData();
    const notebooks = Array.isArray(userData.notebooks) ? userData.notebooks : [];
    const readMails = Array.isArray(userData.readMails) ? userData.readMails : [];
    const mailReplies = userData.mailReplies || {};

    const normalizedNotebooks = notebooks.map((notebook) => ({
        id: notebook.id,
        name: notebook.name || '未命名手记本',
        parentId: notebook.parentId || null,
        isDefault: !!notebook.isDefault,
        createdAt: notebook.createdAt || null,
        icon: notebook.icon || null,
        source: 'ithaca-journal'
    }));

    const normalizedEntries = journalEntries.map((entry) => ({
        id: String(entry.id),
        kind: 'journal-entry',
        content: entry.content || '',
        createdAt: entry.createdAt || entry.timestamp || null,
        timestamp: entry.timestamp || entry.createdAt || null,
        displayDate: entry.date || null,
        displayTime: entry.time || null,
        notebookIds: Array.isArray(entry.notebookIds) ? [...entry.notebookIds] : [],
        tags: Array.isArray(entry.tags) ? [...entry.tags] : [],
        status: {
            isConfirmed: !!entry.isConfirmed,
            isDeleted: !!entry.isDeleted
        },
        metrics: {
            savedWordCount: entry.savedWordCount || 0
        },
        legacy: {
            sourceApp: 'ithaca-journal'
        }
    }));

    const normalizedBooks = libraryBooks.map((book) => ({
        id: String(book.id),
        kind: 'book',
        title: book.title || '未命名书稿',
        content: book.content || '',
        cover: book.cover || null,
        author: book.author || null,
        createdAt: book.createdAt || null,
        displayDate: book.date || null,
        status: {
            isDeleted: !!book.isDeleted,
            isReadOnly: !!book.isReadOnly,
            isRare: !!book.isRare
        },
        legacy: {
            sourceApp: 'ithaca-journal'
        }
    }));

    const reflections = Object.entries(mailReplies).map(([day, content]) => ({
        day: Number(day),
        content: content || '',
        wasMailRead: readMails.includes(Number(day))
    })).sort((a, b) => a.day - b.day);

    return {
        format: 'waiting-journal-import',
        schemaVersion: WAITING_JOURNAL_HANDOFF_VERSION,
        exportedAt: new Date().toISOString(),
        sourceApp: {
            id: 'ithaca-journal',
            name: 'Ithaca Journal'
        },
        user: {
            startDate: userData.startDate || null,
            currentDay: userData.day || 1,
            totalWords: userData.totalWords || 0,
            ink: userData.ink || 0,
            achievements: Array.isArray(userData.achievements) ? [...userData.achievements] : []
        },
        notebooks: normalizedNotebooks,
        writings: normalizedEntries,
        books: normalizedBooks,
        reflections,
        world: {
            fragments: Array.isArray(userData.fragments) ? [...userData.fragments] : [],
            unlockedScripts: Array.isArray(userData.unlockedScripts) ? [...userData.unlockedScripts] : [],
            inventory: Array.isArray(userData.inventory) ? [...userData.inventory] : [],
            layout: Array.isArray(userData.layout) ? cloneData(userData.layout) : []
        }
    };
}

export const ArchiveManager = {
    buildArchivePayload() {
        return {
            format: ARCHIVE_FORMAT,
            schemaVersion: ARCHIVE_SCHEMA_VERSION,
            exportedAt: new Date().toISOString(),
            sourceApp: {
                id: 'ithaca-journal',
                name: 'Ithaca Journal',
                channel: 'legacy'
            },
            summary: buildSummary(),
            data: {
                userData: cloneData(UserData.getExportData()),
                journalEntries: cloneData(Journal.getExportData()),
                libraryBooks: cloneData(Library.getExportData())
            },
            handoff: {
                waitingJournal: buildWaitingJournalHandoff()
            }
        };
    },

    async exportArchive() {
        UserData.save();
        Journal.save();
        Library.save();

        const payload = this.buildArchivePayload();
        const archiveJson = JSON.stringify(payload, null, 2);

        if (!window.ithacaSystem || !window.ithacaSystem.exportArchive) {
            alert('当前环境不支持完整存档导出。');
            return { success: false, message: 'unsupported' };
        }

        return window.ithacaSystem.exportArchive(archiveJson);
    },

    extractJournalEntries(importedPayload) {
        if (Array.isArray(importedPayload)) return importedPayload;
        if (!importedPayload || typeof importedPayload !== 'object') return null;

        if (importedPayload.format === ARCHIVE_FORMAT) {
            return importedPayload.data?.journalEntries || null;
        }

        if (Array.isArray(importedPayload.entries)) {
            return importedPayload.entries;
        }

        if (Array.isArray(importedPayload.journalEntries)) {
            return importedPayload.journalEntries;
        }

        if (Array.isArray(importedPayload.data?.entries)) {
            return importedPayload.data.entries;
        }

        return null;
    },

    extractArchiveData(importedPayload) {
        if (!importedPayload || typeof importedPayload !== 'object') return null;

        if (importedPayload.format === ARCHIVE_FORMAT) {
            return importedPayload.data || null;
        }

        if (
            importedPayload.userData ||
            importedPayload.journalEntries ||
            importedPayload.libraryBooks
        ) {
            return importedPayload;
        }

        if (
            importedPayload.data?.userData ||
            importedPayload.data?.journalEntries ||
            importedPayload.data?.libraryBooks
        ) {
            return importedPayload.data;
        }

        return null;
    },

    extractWaitingJournalHandoff(importedPayload) {
        if (!importedPayload || typeof importedPayload !== 'object') return null;

        if (importedPayload.handoff?.waitingJournal) {
            return importedPayload.handoff.waitingJournal;
        }

        if (importedPayload.format === 'waiting-journal-import') {
            return importedPayload;
        }

        return null;
    },

    async restoreArchivePayload(importedPayload) {
        const archiveData = this.extractArchiveData(importedPayload);
        if (!archiveData) {
            throw new Error('未找到可恢复的完整存档数据。');
        }

        if (!archiveData.userData || typeof archiveData.userData !== 'object') {
            throw new Error('存档缺少 userData。');
        }
        if (!Array.isArray(archiveData.journalEntries)) {
            throw new Error('存档缺少 journalEntries。');
        }
        if (!Array.isArray(archiveData.libraryBooks)) {
            throw new Error('存档缺少 libraryBooks。');
        }

        UserData.replaceState(archiveData.userData, { save: false });
        Journal.replaceEntries(archiveData.journalEntries, { save: false });
        Library.replaceBooks(archiveData.libraryBooks, { save: false });

        await Promise.all([
            UserData.save(),
            Journal.save(),
            Library.save()
        ]);

        return {
            success: true,
            summary: buildSummary()
        };
    },

    async promptAndRestoreArchive() {
        if (!window.ithacaSystem || !window.ithacaSystem.importData) {
            alert('当前环境不支持完整存档导入。');
            return { success: false, message: 'unsupported' };
        }

        const result = await window.ithacaSystem.importData();
        if (!result || !result.success) {
            return { success: false, message: result?.msg || '用户取消' };
        }

        const payload = JSON.parse(result.data);
        return this.restoreArchivePayload(payload);
    }
};
