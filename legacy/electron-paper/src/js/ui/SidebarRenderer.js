/* src/js/ui/SidebarRenderer.js */
import { Journal } from '../data/Journal.js';
import { Library } from '../data/Library.js';
import { UserData } from '../data/UserData.js';
import { HUDRenderer } from './HUDRenderer.js';
import { marked } from '../libs/marked.esm.js';

const Icons = {
    arrowRight: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
    allMemory: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`,
    daily: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    folder: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
    fileText: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
    trash: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    tags: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>`,
    edit: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    deleteItem: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
};

export const SidebarRenderer = {
    currentNotebookId: 'REPO_ALL_ID', 
    activeEntryId: null,              
    expandedFolders: new Set(['REPO_ALL_ID', 'nb_daily']), 
    currentTag: null,

    init() {
        const addBtn = document.getElementById('btn-new-entry');
        if (addBtn) addBtn.onclick = () => this.handleNewEntry();
        this.bindEditorEvents();
        const all = Journal.getAll();
        if (all.length > 0 && !this.activeEntryId) {
            this.activeEntryId = String(all[0].id);
        }
        this.loadActiveEntry();
    },

    bindEditorEvents() {
        const editor = document.getElementById('editor-area');
        if (editor) {
            editor.oninput = () => {
                if (this.activeEntryId) {
                    Journal.updateEntry(this.activeEntryId, editor.value);
                    HUDRenderer.updateAll(); 
                    this.updateSaveStatus("正在保存...", "#666");
                    this.updateSidebarItemPreview(this.activeEntryId, editor.value);
                    clearTimeout(this._saveTimer);
                    this._saveTimer = setTimeout(() => {
                        this.updateSaveStatus("已自动保存", "#999");
                        if (this.expandedFolders.has('TAG_ROOT')) {
                            this.render();
                        }
                    }, 800);
                }
            };
        }
        const btnConfirm = document.getElementById('btn-confirm-entry');
        if (btnConfirm) btnConfirm.onclick = () => this.handleConfirmEntry();
        const btnDelete = document.getElementById('btn-delete-entry');
        if (btnDelete) btnDelete.onclick = () => this.handleDeleteEntry();
        const btnPreview = document.getElementById('btn-toggle-journal-preview');
        if (btnPreview) btnPreview.onclick = () => this.togglePreview();
    },

    updateSaveStatus(msg, color) {
        const el = document.getElementById('save-status');
        if(el) { el.innerText = msg; el.style.color = color; }
    },

    updateSidebarItemPreview(id, content) {
        const previewEl = document.getElementById(`entry-preview-${id}`);
        if (previewEl) {
            previewEl.innerText = content.slice(0, 15).replace(/\n/g, ' ') || '新篇章...';
        }
    },

    handleConfirmEntry() {
        if (!this.activeEntryId) return;
        if (Journal.confirmEntry(this.activeEntryId)) {
            UserData.addInk(10);
            UserData.unlockAchievement('ach_diary');
            HUDRenderer.updateAll();
            this.render(); 
            const currentEntry = Journal.getAll().find(e => String(e.id) === String(this.activeEntryId));
            this.updateConfirmButtonState(currentEntry);
            HUDRenderer.log("✅ 记忆已确认。墨水 +10ml。");
        }
    },

    handleDeleteEntry() {
        if (!this.activeEntryId) return;
        if (confirm("确定要撕毁这一页日记吗？此操作无法撤销。")) {
            Journal.deleteEntry(this.activeEntryId);
            HUDRenderer.log("🗑️ 撕毁了一页记忆。");
            const remaining = this.getEntriesForFolder(this.currentNotebookId);
            this.activeEntryId = remaining.length > 0 ? String(remaining[0].id) : null;
            this.render();
            this.loadActiveEntry();
            HUDRenderer.updateAll();
        }
    },

    togglePreview() {
        const editor = document.getElementById('editor-area');
        const preview = document.getElementById('editor-preview');
        const btn = document.getElementById('btn-toggle-journal-preview');
        if (!editor || !preview || !btn) return;

        if (preview.style.display === 'none') {
            preview.innerHTML = marked.parse(editor.value, { breaks: true });
            preview.style.display = 'block';
            btn.innerText = "✏️ 继续编辑";
            btn.style.background = "#333";
        } else {
            preview.style.display = 'none';
            btn.innerText = "👁️ 预览";
            btn.style.background = "#666";
            editor.focus();
        }
    },

    getEntriesForFolder(folderId) {
        if (!folderId) return [];
        const all = Journal.getAll();
        if (folderId === 'REPO_ALL_ID') return all;
        if (folderId === 'INBOX_VIRTUAL_ID') return all.filter(e => !e.notebookIds || e.notebookIds.length === 0);
        return all.filter(e => e.notebookId === folderId || (e.notebookIds && e.notebookIds.includes(folderId)));
    },

    render() {
        const listEl = document.getElementById('journal-list');
        const headerEl = document.querySelector('.sidebar-header h4');
        if (!listEl) return;
        listEl.innerHTML = "";
        
        if (headerEl) headerEl.innerText = "手记目录";

        this.renderAccordionSection(listEl, 'REPO_ALL_ID', '所有记忆', Icons.allMemory, this.getEntriesForFolder('REPO_ALL_ID'));
        this.renderAccordionSection(listEl, 'nb_daily', '日常碎片', Icons.daily, this.getEntriesForFolder('nb_daily'));

        const topLevelNotebooks = UserData.state.notebooks.filter(nb => 
            (nb.id !== 'nb_inbox' && nb.id !== 'nb_daily') && !nb.parentId
        );
        topLevelNotebooks.forEach(nb => {
            this.renderAccordionSection(listEl, nb.id, nb.name, Icons.folder, this.getEntriesForFolder(nb.id), nb);
        });

        this.renderCreateFolderBtn(listEl);
        this.renderTagsSection(listEl);
        
        const trashEntries = [
            ...Journal.getTrash().map(j => ({ ...j, type: 'journal' })),
            ...Library.getTrash().map(b => ({ ...b, type: 'book' }))
        ];
        this.renderAccordionSection(listEl, 'TRASH_BIN_ID', '废纸篓', Icons.trash, trashEntries, null, true);
    },

    renderAccordionSection(container, folderId, title, iconSvg, entries, customNbData = null, isTrash = false) {
        const isExpanded = this.expandedFolders.has(folderId);
        const isActive = this.currentNotebookId === folderId;

        const header = document.createElement('div');
        header.className = `accordion-header ${isActive ? 'active-folder' : ''}`;
        
        let actionsHtml = '';
        if (customNbData) {
            actionsHtml = `
                <div class="folder-actions">
                    <span class="folder-action-btn btn-edit" title="重命名">${Icons.edit}</span>
                    <span class="folder-action-btn btn-del" title="删除">${Icons.deleteItem}</span>
                </div>
            `;
        }

        header.innerHTML = `
            <span class="folder-arrow ${isExpanded ? 'expanded' : ''}">${Icons.arrowRight}</span>
            <span class="folder-icon">${iconSvg}</span>
            <span class="folder-title">${title}</span>
            <span class="folder-count">${entries.length}</span>
            ${actionsHtml}
        `;

        if (customNbData) {
            header.setAttribute('draggable', 'true');
            header.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', folderId);
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => header.style.opacity = '0.4', 0); 
            };
            header.ondragend = () => { header.style.opacity = '1'; };
        }

        header.ondragover = (e) => {
            e.preventDefault(); 
            e.stopPropagation(); // 🛡️ 防止冒泡到父文件夹
            e.dataTransfer.dropEffect = 'move';
            header.classList.remove('drag-over-inside', 'drag-over-before', 'drag-over-after', 'drag-over-root');
            if (folderId === 'REPO_ALL_ID') { header.classList.add('drag-over-root'); return; }
            if (folderId === 'TRASH_BIN_ID' || folderId === 'nb_daily') {
                header.classList.add('drag-over-inside');
                header.dataset.dropAction = 'inside';
                return;
            }

            const rect = header.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const height = rect.height;

            if (y < height * 0.25) {
                header.classList.add('drag-over-before'); header.dataset.dropAction = 'before';
            } else if (y > height * 0.75) {
                header.classList.add('drag-over-after'); header.dataset.dropAction = 'after';
            } else {
                header.classList.add('drag-over-inside'); header.dataset.dropAction = 'inside';
            }
        };

        header.ondragleave = (e) => {
            header.classList.remove('drag-over-inside', 'drag-over-before', 'drag-over-after', 'drag-over-root');
            delete header.dataset.dropAction;
        };

        header.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation(); // 🛡️ 核心修复：放到子文件夹后，立刻斩断事件，防止父文件夹截胡
            
            const dropAction = header.dataset.dropAction || 'inside';
            header.classList.remove('drag-over-inside', 'drag-over-before', 'drag-over-after', 'drag-over-root');
            delete header.dataset.dropAction;
            
            const dragData = e.dataTransfer.getData('text/plain');
            
            if (dragData && dragData.startsWith('entry|')) {
                const parts = dragData.split('|');
                const entryId = parts[1];
                const sourceNbId = parts[2];
                if (sourceNbId === folderId) return; 

                Journal.moveToNotebook(entryId, folderId);
                if (folderId === 'TRASH_BIN_ID') HUDRenderer.log("🗑️ 日记已丢入废纸篓");
                else if (folderId !== 'REPO_ALL_ID') this.expandedFolders.add(folderId);

                if (String(this.activeEntryId) === String(entryId)) this.loadActiveEntry();
                this.render();
                return;
            }

            if (dragData && dragData.startsWith('nb_') && dragData !== folderId) {
                if (folderId === 'REPO_ALL_ID') {
                    if(typeof UserData.moveNotebook === 'function') UserData.moveNotebook(dragData, null);
                    else UserData.reorderNotebook(dragData, dragData, 'after'); 
                    this.render();
                    return;
                }
                if (folderId === 'TRASH_BIN_ID') {
                    if (confirm("确定要删除这个手记本吗？")) { UserData.deleteNotebook(dragData); this.render(); }
                    return;
                }
                if (folderId === 'nb_daily' || folderId === 'nb_inbox') {
                    HUDRenderer.log("⚠️ 无法移动到系统专属目录中"); return;
                }
                if (typeof UserData.getAllDescendantIds === 'function' && UserData.getAllDescendantIds(dragData).includes(folderId)) {
                    HUDRenderer.log("⚠️ 无法将父目录拖入其子目录中"); return;
                }
                if (typeof UserData.reorderNotebook === 'function') UserData.reorderNotebook(dragData, folderId, dropAction);
                if (dropAction === 'inside') this.expandedFolders.add(folderId); 
                this.render();
            }
        };

        if (customNbData) {
            header.querySelector('.btn-edit').onclick = (e) => {
                e.stopPropagation(); this.showNotebookInputModal('rename', folderId, title);
            };
            header.querySelector('.btn-del').onclick = (e) => {
                e.stopPropagation();
                if (confirm(`确定要删除《${title}》吗？\n（如果是父级目录，其子目录将被移出。日记仍保留在“所有记忆”中。）`)) {
                    UserData.deleteNotebook(folderId); this.render();
                }
            };
        }

        header.onclick = (e) => {
            e.stopPropagation();
            this.currentTag = null; 
            this.currentNotebookId = folderId; 
            if (this.expandedFolders.has(folderId)) this.expandedFolders.delete(folderId); 
            else this.expandedFolders.add(folderId);    
            this.render(); 
        };

        container.appendChild(header);

        // Body 容器
        const body = document.createElement('div');
        body.className = 'accordion-body';
        body.style.display = isExpanded ? 'block' : 'none';

        body.ondragover = (e) => {
            e.preventDefault(); 
            e.stopPropagation(); // 🛡️ 同样防止内部区域冒泡
            e.dataTransfer.dropEffect = 'move';
        };
        body.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation(); // 🛡️ 防止触发上级目录的掉落
            
            const dragData = e.dataTransfer.getData('text/plain');
            if (dragData && dragData.startsWith('entry|')) {
                const parts = dragData.split('|');
                const entryId = parts[1];
                const sourceNbId = parts[2];
                if (sourceNbId !== folderId) {
                    Journal.moveToNotebook(entryId, folderId);
                    this.expandedFolders.add(folderId);
                    if (String(this.activeEntryId) === String(entryId)) this.loadActiveEntry();
                    this.render();
                }
            }
        };

        if (customNbData) {
            const childNotebooks = UserData.state.notebooks.filter(nb => nb.parentId === folderId);
            childNotebooks.forEach(childNb => {
                this.renderAccordionSection(body, childNb.id, childNb.name, Icons.folder, this.getEntriesForFolder(childNb.id), childNb);
            });
        }

        if (entries.length === 0 && (!customNbData || UserData.state.notebooks.filter(nb => nb.parentId === folderId).length === 0)) {
            body.innerHTML += `<div style="font-size:12px; color:#ccc; padding:4px 0;">空空如也...</div>`;
        } else {
            entries.forEach(entry => {
                if (isTrash) this.renderTrashItem(body, entry);
                else this.renderEntryItem(body, entry, folderId); 
            });
        }
        container.appendChild(body);
    },

    renderEntryItem(container, entry, parentFolderId = null) {
        // 🌟 修复渲染时 ID 判断类型不一致导致的 active 高亮失效
        const isActive = String(entry.id) === String(this.activeEntryId);
        const item = document.createElement('div');
        item.className = `list-item ${isActive ? 'active' : ''}`;
        
        const previewText = (entry.content || "").slice(0, 15).replace(/\n/g, ' ') || '新篇章...';
        const statusDot = entry.isConfirmed ? `<span style="color:#4caf50;font-size:10px;margin-right:4px;">●</span>` : '';

        item.innerHTML = `
            <span class="file-icon">${Icons.fileText}</span>
            <div style="flex:1; overflow:hidden;">
                <div style="display:flex; justify-content:space-between; font-size:12px; color:#777; margin-bottom:2px;">
                    <span>${statusDot}${entry.date}</span>
                    <span style="font-size:10px; color:#aaa;">${entry.time || ""}</span>
                </div>
                <div id="entry-preview-${entry.id}" style="font-size:13px; color:#333; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${previewText}
                </div>
            </div>
        `;

        item.setAttribute('draggable', 'true');
        item.ondragstart = (e) => {
            const sourceId = parentFolderId || this.currentNotebookId;
            e.dataTransfer.setData('text/plain', `entry|${entry.id}|${sourceId}`);
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => item.style.opacity = '0.4', 0);
        };
        item.ondragend = () => { item.style.opacity = '1'; };

        item.ondragenter = (e) => { e.preventDefault(); }; 
        item.ondragover = (e) => {
            e.preventDefault();
            e.stopPropagation(); 
            item.style.borderTop = "2px solid #5d4037"; 
        };
        
        item.ondragleave = () => { item.style.borderTop = ""; };
        
        item.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation(); 
            item.style.borderTop = ""; 

            const dragData = e.dataTransfer.getData('text/plain');
            if (dragData && dragData.startsWith('entry|')) {
                const parts = dragData.split('|');
                const draggedEntryId = parts[1];
                const sourceFolderId = parts[2];
                
                if (String(draggedEntryId) !== String(entry.id)) {
                    if (parentFolderId && parentFolderId !== 'TAG_ROOT' && parentFolderId !== sourceFolderId) {
                        Journal.moveToNotebook(draggedEntryId, parentFolderId);
                    }
                    if (Journal.reorderEntry) {
                        Journal.reorderEntry(draggedEntryId, entry.id);
                    }
                    this.render(); 
                }
            }
        };

        item.onclick = (e) => {
            e.stopPropagation();
            this.activeEntryId = String(entry.id);
            this.render(); 
            this.loadActiveEntry();
        };
        container.appendChild(item);
    },

    renderTagsSection(container) {
        const tags = typeof Journal.getAllTags === 'function' ? Journal.getAllTags() : [];
        const isExpanded = this.expandedFolders.has('TAG_ROOT');
        
        const sectionDiv = document.createElement('div');
        sectionDiv.style.marginTop = "15px";
        sectionDiv.style.borderTop = "1px solid #eaeaea";
        sectionDiv.style.paddingTop = "5px";
        
        const header = document.createElement('div');
        header.className = `accordion-header ${this.currentTag ? 'active-folder' : ''}`;
        header.innerHTML = `
            <span class="folder-arrow ${isExpanded ? 'expanded' : ''}">${Icons.arrowRight}</span>
            <span class="folder-icon">${Icons.tags}</span>
            <span class="folder-title">我的标签</span>
            <span class="folder-count">${tags.length}</span>
        `;
        header.onclick = () => {
            if (this.expandedFolders.has('TAG_ROOT')) this.expandedFolders.delete('TAG_ROOT');
            else this.expandedFolders.add('TAG_ROOT');
            this.render();
        };
        sectionDiv.appendChild(header);

        const body = document.createElement('div');
        body.className = 'accordion-body';
        body.style.display = isExpanded ? 'block' : 'none';
        
        const pillsContainer = document.createElement('div');
        pillsContainer.className = 'flomo-tags-container';
        
        if (tags.length === 0) {
            pillsContainer.innerHTML = `<div style="font-size:12px; color:#ccc; padding:4px 0;">在手记中输入 #标签 自动提取</div>`;
        } else {
            tags.forEach(tag => {
                const pill = document.createElement('span');
                pill.className = `flomo-tag ${this.currentTag === tag ? 'active' : ''}`;
                pill.innerText = `#${tag}`;
                pill.onclick = (e) => {
                    e.stopPropagation();
                    if (this.currentTag === tag) {
                        this.currentTag = null; 
                        this.currentNotebookId = 'REPO_ALL_ID'; 
                    } else {
                        this.currentTag = tag;
                        this.currentNotebookId = null; 
                    }
                    this.render();
                };
                pillsContainer.appendChild(pill);
            });
        }
        body.appendChild(pillsContainer);

        if (this.currentTag) {
            const entries = Journal.getAll().filter(e => e.tags && e.tags.includes(this.currentTag));
            const entriesContainer = document.createElement('div');
            entriesContainer.style.marginTop = "10px";
            entriesContainer.style.borderTop = "1px dashed #eee";
            entriesContainer.style.paddingTop = "8px";
            
            if (entries.length === 0) {
                entriesContainer.innerHTML = `<div style="font-size:12px; color:#ccc;">没有找到该标签相关的日记</div>`;
            } else {
                entries.forEach(entry => this.renderEntryItem(entriesContainer, entry, 'TAG_ROOT'));
            }
            body.appendChild(entriesContainer);
        }

        sectionDiv.appendChild(body);
        container.appendChild(sectionDiv);
    },

    renderTrashItem(container, itemData) {
        const item = document.createElement('div');
        item.className = 'list-item trash-item';
        const isJournal = itemData.type === 'journal';
        const title = isJournal ? (itemData.content.substring(0, 15).replace(/\n/g,' ') + '...') : `《${itemData.title}》`;
        
        item.innerHTML = `
            <span class="file-icon">${Icons.fileText}</span>
            <div style="flex:1; overflow:hidden;">
                <div style="font-size:12px; color:#999; margin-bottom:4px;">${itemData.date || '未知'}</div>
                <div class="trash-item-title" style="font-size:13px; margin-bottom:6px;">${title}</div>
                <div style="display:flex; gap:8px;">
                    <span class="btn-restore" style="font-size:11px; color:#2e7d32; cursor:pointer; background:#e8f5e9; padding:2px 6px; border-radius:4px;">♻️ 还原</span>
                    <span class="btn-burn" style="font-size:11px; color:#c62828; cursor:pointer; background:#ffebee; padding:2px 6px; border-radius:4px;">彻底焚毁</span>
                </div>
            </div>
        `;

        item.querySelector('.btn-restore').onclick = (e) => {
            e.stopPropagation();
            if (isJournal) Journal.restoreEntry(itemData.id);
            else Library.restoreBook(itemData.id);
            this.render(); 
            HUDRenderer.updateAll(); 
        };

        item.querySelector('.btn-burn').onclick = (e) => {
            e.stopPropagation();
            if (confirm(`彻底焚毁将永远无法复原，确定吗？`)) {
                if (isJournal) Journal.hardDeleteEntry(itemData.id);
                else Library.hardDeleteBook(itemData.id);
                this.render();
                HUDRenderer.updateAll(); 
            }
        };
        container.appendChild(item);
    },

    renderCreateFolderBtn(container) {
        const btn = document.createElement('div');
        btn.className = 'accordion-header';
        btn.style.color = '#888';
        btn.innerHTML = `
            <span class="folder-arrow" style="visibility:hidden;"></span>
            <span class="folder-icon" style="font-size:16px;">+</span>
            <span class="folder-title">新建大类手记...</span>
        `;
        btn.onclick = () => this.showNotebookInputModal('create');
        container.appendChild(btn);
    },

    handleNewEntry() {
        const newEntry = Journal.createNewEntry();
        this.activeEntryId = String(newEntry.id);

        if (this.currentNotebookId && !['REPO_ALL_ID', 'INBOX_VIRTUAL_ID', 'TRASH_BIN_ID'].includes(this.currentNotebookId)) {
            Journal.toggleNotebook(newEntry.id, this.currentNotebookId);
            this.expandedFolders.add(this.currentNotebookId); 
            
            const currentNb = UserData.state.notebooks.find(n => n.id === this.currentNotebookId);
            if (currentNb && currentNb.parentId) {
                this.expandedFolders.add(currentNb.parentId);
            }
        } else {
            this.expandedFolders.add('REPO_ALL_ID');
            this.currentNotebookId = 'REPO_ALL_ID'; 
            this.currentTag = null; 
        }

        this.render();
        this.loadActiveEntry();
        
        const editor = document.getElementById('editor-area');
        if(editor) editor.focus();
    },

    loadActiveEntry() {
        const editor = document.getElementById('editor-area');
        const preview = document.getElementById('editor-preview');

        if (preview) preview.style.display = 'none';
        const btnPreview = document.getElementById('btn-toggle-journal-preview');
        if (btnPreview) {
             btnPreview.innerText = "👁️ 预览";
             btnPreview.style.background = "#666";
        }

        if (!this.activeEntryId) {
            if (editor) editor.value = "";
            return;
        }

        const entry = Journal.getAll().find(e => String(e.id) === String(this.activeEntryId));
        if (entry) {
            if (editor) editor.value = entry.content;
            this.updateConfirmButtonState(entry);
        } else {
            if (editor) editor.value = "";
        }
    },

    updateConfirmButtonState(entry) {
        const btn = document.getElementById('btn-confirm-entry');
        if (!btn) return;
        if (entry.isConfirmed) {
            btn.innerText = "已归档 (墨水已领)";
            btn.style.background = "#ccc";
            btn.style.cursor = "default";
            btn.disabled = true; 
        } else {
            btn.innerText = "✅ 确认记录 (+10 墨水)";
            btn.style.background = "#5d4037"; 
            btn.style.cursor = "pointer";
            btn.disabled = false;
        }
    },

    showNotebookInputModal(mode = 'create', targetId = null, currentName = '') {
        const existing = document.getElementById('dynamic-modal-input');
        if (existing) existing.remove();

        const isRename = (mode === 'rename');
        let titleText = isRename ? "重命名" : "新建大类手记";

        const overlay = document.createElement('div');
        overlay.id = 'dynamic-modal-input';
        overlay.className = 'modal-overlay'; 
        overlay.style.cssText = 'display:flex; z-index:9999;';
        
        const content = document.createElement('div');
        content.className = 'modal-content';
        content.style.cssText = 'width:320px; text-align:center; background:#fff; padding:20px; border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.3);';

        content.innerHTML = `
            <h3 style="margin-top:0; color:#333;">${titleText}</h3>
            <input type="text" id="notebook-input-field" value="${isRename ? currentName : ""}" placeholder="请输入名称..." 
                   style="width:100%; padding:10px; margin-bottom:20px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box; outline:none;">
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button id="btn-cancel-input" class="btn-cancel">取消</button>
                <button id="btn-confirm-input" class="btn-primary">${isRename ? "保存" : "创建"}</button>
            </div>
        `;

        overlay.appendChild(content);
        document.body.appendChild(overlay);

        const input = content.querySelector('#notebook-input-field');
        const close = () => overlay.remove();
        
        const confirmAction = () => {
            const name = input.value.trim();
            if (!name) return alert("名称不能为空");

            if (isRename) {
                UserData.renameNotebook(targetId, name);
            } else {
                UserData.createNotebook(name);
            }
            
            this.render();
            close();
        };

        content.querySelector('#btn-cancel-input').onclick = close;
        content.querySelector('#btn-confirm-input').onclick = confirmAction;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') confirmAction();
            if (e.key === 'Escape') close();
        };

        setTimeout(() => { input.focus(); if(isRename) input.select(); }, 50);
    }
};