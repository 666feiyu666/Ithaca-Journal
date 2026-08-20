/* src/js/ui/WorkbenchRenderer.js */
import { Binder } from '../logic/Binder.js';
import { Journal } from '../data/Journal.js';
import { UserData } from '../data/UserData.js';
import { ModalManager } from './ModalManager.js';
import { BookshelfRenderer } from './BookshelfRenderer.js';
import { HUDRenderer } from './HUDRenderer.js';
import { marked } from '../libs/marked.esm.js';
import { ArchiveManager } from '../data/ArchiveManager.js';

export const WorkbenchRenderer = {
    init() {
        this.bindEvents();
    },

    bindEvents() {
        const btnOpen = document.getElementById('btn-open-workbench');
        if (btnOpen) {
            btnOpen.onclick = () => {
                ModalManager.open('workbench-modal');
                this.render();
            };
        }

        // ✨ 修复：绑定“取消”按钮，使其能关闭弹窗
        const btnClose = document.getElementById('btn-close-workbench');
        if (btnClose) {
            btnClose.onclick = () => {
                ModalManager.close('workbench-modal');
            };
        }

        const btnPublish = document.getElementById('btn-publish');
        if (btnPublish) {
            btnPublish.onclick = () => this.handlePublish();
        }

        const btnPreview = document.getElementById('btn-toggle-manuscript-preview');
        if (btnPreview) {
            btnPreview.onclick = () => this.togglePreview();
        }

        const btnImport = document.getElementById('btn-import-journal');
        if (btnImport) {
            btnImport.onclick = () => this.handleImportJournal();
        }

        const notebookSelect = document.getElementById('workbench-filter-notebook');
        const searchInput = document.getElementById('workbench-search');
        if (notebookSelect) {
            notebookSelect.onchange = () => this.renderList(searchInput?.value, notebookSelect.value);
        }
        if (searchInput) {
            searchInput.addEventListener('input', (e) => 
                this.renderList(e.target.value, notebookSelect?.value || 'ALL')
            );
        }

        const manuEditor = document.getElementById('manuscript-editor');
        if(manuEditor) {
            manuEditor.addEventListener('input', (e) => Binder.updateManuscript(e.target.value));
        }

        // 封面选择事件
        const covers = document.querySelectorAll('.cover-option');
        covers.forEach(img => {
            img.onclick = () => {
                covers.forEach(c => c.classList.remove('selected'));
                img.classList.add('selected');
                const fullPath = `assets/images/booksheet/${img.dataset.cover}`;
                Binder.setCover(fullPath);
            };
        });
    },

    render() {
        this.renderNotebookSelector();
        this.renderList();
        
        const titleInput = document.getElementById('manuscript-title-input');
        if (titleInput) titleInput.value = "";
        
        const editor = document.getElementById('manuscript-editor');
        if(editor) editor.value = Binder.currentManuscript;

        // 重置封面选择
        const covers = document.querySelectorAll('.cover-option');
        covers.forEach(c => c.classList.remove('selected'));
        if(covers.length > 0) covers[0].classList.add('selected');
        Binder.setCover('assets/images/booksheet/booksheet1.png');
    },

    renderNotebookSelector() {
        const selectEl = document.getElementById('workbench-filter-notebook');
        if (!selectEl) return;

        const currentVal = selectEl.value;

        // ✨ 修复：手动添加 'nb_daily' (日常碎片) 到下拉菜单中
        // 顺序：所有 -> 收件箱 -> 日常碎片 -> (自定义本子...)
        let html = `
            <option value="ALL">所有记忆</option>
            <option value="INBOX_VIRTUAL_ID">收件箱 (未分类)</option>
            <option value="nb_daily">日常碎片</option>
        `;
        
            UserData.state.notebooks.forEach(nb => {
            // 🛡️ 防御性过滤：如果在自定义列表里发现了重复的 'nb_daily' 或 'nb_inbox'，跳过不渲染
            // 避免下拉菜单里出现两个“日常碎片”
            if (nb.id === 'nb_daily' || nb.id === 'nb_inbox') return;

            // 处理图标 (复用上一轮的优化逻辑)
            const isPath = nb.icon && (nb.icon.includes('/') || nb.icon.includes('.'));
            const displayIcon = isPath ? '' : (nb.icon || '');
            
            html += `<option value="${nb.id}">${displayIcon} ${nb.name}</option>`;
        });

        selectEl.innerHTML = html;

        if (currentVal) selectEl.value = currentVal;
    },

    renderList(filterText = "", filterNotebookId = "ALL") {
        const listEl = document.getElementById('workbench-sources');
        if (!listEl) return;
        listEl.innerHTML = "";

        const entries = Journal.getAll().filter(entry => {
            // 安全性优化：防止 content 为空导致报错
            const content = entry.content || "";
            const matchText = !filterText || content.toLowerCase().includes(filterText.toLowerCase());
            
            let matchNotebook = true;
            if (filterNotebookId === "ALL") {
                matchNotebook = true;
            } else if (filterNotebookId === "INBOX_VIRTUAL_ID") {
                matchNotebook = (!entry.notebookIds || entry.notebookIds.length === 0);
            } else {
                // ✨ 修复核心：使用 some + String() 解决 "数字 vs 字符串" 的类型匹配问题
                matchNotebook = entry.notebookIds && entry.notebookIds.some(id => String(id) === String(filterNotebookId));
            }
            
            return matchText && matchNotebook;
        });

        if (entries.length === 0) {
            listEl.innerHTML = `<div style="color:#999; text-align:center;">没有找到相关记忆</div>`;
            return;
        }

        entries.forEach(entry => {
            const btn = document.createElement('div');
            btn.className = 'list-item';
            btn.innerHTML = `
                <div style="font-weight:bold;">➕ ${entry.date}</div>
                <div style="font-size:12px; color:#666;">${entry.content.substring(0, 20)}...</div>
            `;
            btn.onclick = () => {
                Binder.appendFragment(entry.content);
                const editor = document.getElementById('manuscript-editor');
                if (editor) editor.value = Binder.currentManuscript;
            };
            listEl.appendChild(btn);
        });
    },

    handlePublish() {
        const editor = document.getElementById('manuscript-editor');
        const content = editor.value;
        const titleInput = document.getElementById('manuscript-title-input');
        let title = titleInput ? titleInput.value.trim() : "";

        if (content.length < 10) return alert("字数太少，无法出版 (至少10字)");
        if (!title) title = "无题_" + new Date().toLocaleDateString();

        Binder.updateManuscript(content);
        const result = Binder.publish(title);

        if (result.success) {
            alert(`🎉 出版成功！\n获得墨水：${Math.floor(content.length / 2)} ml`);
            
            // 🏆【新增埋点】成就：作家
            UserData.unlockAchievement('ach_author');

            editor.value = "";
            if (titleInput) titleInput.value = "";
            
            BookshelfRenderer.render();
            HUDRenderer.updateAll();
            ModalManager.close('workbench-modal');
        } else {
            alert("出版失败：" + result.msg);
        }
    },

    async handleImportJournal() {
        if (!window.ithacaSystem || !window.ithacaSystem.importData) {
            alert('当前环境不支持导入备份。');
            return;
        }

        const result = await window.ithacaSystem.importData();
        if (!result || !result.success) {
            if (result?.msg && result.msg !== '用户取消') {
                alert(result.msg);
            }
            return;
        }

        try {
            const importedPayload = JSON.parse(result.data);
            const archiveData = ArchiveManager.extractArchiveData(importedPayload);
            if (archiveData?.userData && archiveData?.journalEntries && archiveData?.libraryBooks) {
                const shouldRestoreAll = confirm("检测到这是一个完整存档备份。\n\n确定要恢复整个应用状态吗？\n点击“取消”则只导入其中的日记内容。");
                if (shouldRestoreAll) {
                    await ArchiveManager.restoreArchivePayload(importedPayload);
                    alert('✅ 完整存档恢复完成，应用将重新加载。');
                    window.location.reload();
                    return;
                }
            }

            const importedEntries = ArchiveManager.extractJournalEntries(importedPayload);
            if (!Array.isArray(importedEntries)) {
                alert('导入失败：未找到可识别的日记数据。');
                return;
            }

            await Journal.importData(importedEntries);
            this.renderList();
            HUDRenderer.updateAll();
        } catch (err) {
            console.error('导入备份失败:', err);
            alert(`导入失败：${err.message}`);
        }
    },

    togglePreview() {
        const editor = document.getElementById('manuscript-editor');
        const preview = document.getElementById('manuscript-preview');
        const btn = document.getElementById('btn-toggle-manuscript-preview');

        if (!editor || !preview) return;

        if (preview.style.display === 'none') {
            preview.innerHTML = marked.parse(editor.value, { breaks: true });
            preview.style.display = 'block';
            if(btn) btn.innerText = "✏️ 继续编辑";
        } else {
            preview.style.display = 'none';
            if(btn) btn.innerText = "👁️ 预览";
            editor.focus();
        }
    }
};
