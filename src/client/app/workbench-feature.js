import { formatDate } from "./format.js";

export const CATEGORY_LABELS = Object.freeze({
  "": "未分类",
  fragment: "碎片",
  theme: "主题",
  letter: "书信",
  book: "书籍",
  journal: "日记",
});

export function normalizedTags(value) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(/[，,、]/u);
  return [...new Set(source.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 20);
}

export function entriesForBrowse(entries, { mode, category, tag }) {
  if (mode === "tag") {
    return tag ? entries.filter((entry) => normalizedTags(entry.tags).includes(tag)) : [];
  }
  const selected = category || null;
  return entries.filter((entry) => (entry.category ?? null) === selected);
}

export function createWorkbenchFeature({
  state,
  refs,
  setBusy,
  showApp,
  handleError,
  entries,
}) {
  function allTags() {
    const counts = new Map();
    for (const entry of state.entries) {
      for (const tag of normalizedTags(entry.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right, "zh-CN"));
  }

  function renderFilters() {
    const categoryMode = state.browseMode === "category";
    refs.browseCategoryButton.setAttribute("aria-pressed", String(categoryMode));
    refs.browseTagButton.setAttribute("aria-pressed", String(!categoryMode));
    refs.categoryList.hidden = !categoryMode;
    refs.tagList.hidden = categoryMode;
    refs.tagListEmpty.hidden = categoryMode;

    for (const button of refs.categoryList.querySelectorAll("[data-category]")) {
      const category = button.dataset.category || null;
      const active = categoryMode && (state.selectedCategory || null) === category;
      button.setAttribute("aria-current", String(active));
      const count = state.entries.filter((entry) => (entry.category ?? null) === category).length;
      button.querySelector("small").textContent = String(count);
    }

    const tags = allTags();
    refs.tagList.replaceChildren();
    refs.tagListEmpty.hidden = categoryMode || tags.length !== 0;
    if (!categoryMode && tags.length && !tags.some(([tag]) => tag === state.selectedTag)) {
      state.selectedTag = tags[0][0];
    }
    for (const [tag, count] of tags) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-current", String(!categoryMode && tag === state.selectedTag));
      const label = document.createElement("span");
      label.textContent = `# ${tag}`;
      const total = document.createElement("small");
      total.textContent = String(count);
      button.append(label, total);
      button.addEventListener("click", () => {
        state.selectedTag = tag;
        renderList();
      });
      refs.tagList.append(button);
    }
  }

  function renderList() {
    renderFilters();
    const records = entriesForBrowse(state.entries, {
      mode: state.browseMode,
      category: state.selectedCategory,
      tag: state.selectedTag,
    });
    const heading = state.browseMode === "tag"
      ? (state.selectedTag ? `# ${state.selectedTag}` : "标签")
      : CATEGORY_LABELS[state.selectedCategory ?? ""];
    refs.journalListIndex.textContent = heading;
    refs.entryResultCount.textContent = `${records.length} 张`;
    refs.entryList.replaceChildren();
    refs.listEmpty.textContent = state.browseMode === "tag"
      ? "这个标签下还没有纸页。"
      : `${heading}里还没有纸页。`;
    refs.listEmpty.hidden = records.length !== 0;

    for (const entry of records) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "entry-list__item desk-paper-card";
      item.setAttribute("role", "listitem");
      item.setAttribute("aria-current", String(state.current?.id === entry.id));

      const top = document.createElement("span");
      top.className = "desk-paper-card__top";
      const category = document.createElement("span");
      category.className = `paper-category paper-category--${entry.category ?? "unclassified"}`;
      category.textContent = CATEGORY_LABELS[entry.category ?? ""];
      const date = document.createElement("span");
      date.className = "entry-list__date";
      date.textContent = formatDate(entry.updated_at);
      top.append(category, date);

      const title = document.createElement("strong");
      title.className = "entry-list__title";
      title.dataset.i18nSkip = "";
      title.textContent = entry.title || "没有题目的纸页";
      const excerpt = document.createElement("span");
      excerpt.className = "entry-list__excerpt";
      excerpt.dataset.i18nSkip = "";
      excerpt.textContent = entry.excerpt?.trim() || "这张纸上只留下了一个题目。";
      item.append(top, title, excerpt);

      const tags = normalizedTags(entry.tags);
      if (tags.length) {
        const tagRow = document.createElement("span");
        tagRow.className = "desk-paper-card__tags";
        tagRow.dataset.i18nSkip = "";
        tagRow.textContent = tags.map((tag) => `#${tag}`).join("  ");
        item.append(tagRow);
      }
      item.addEventListener("click", () => void entries.openEntry(entry.id));
      refs.entryList.append(item);
    }
  }

  function showEmptyEditor() {
    state.current = null;
    state.dirty = false;
    refs.editorPanel.hidden = true;
    refs.editorEmpty.hidden = false;
    renderList();
  }

  function selectCategory(category) {
    state.browseMode = "category";
    state.selectedCategory = category || null;
    state.selectedTag = null;
    renderList();
  }

  function selectTagMode() {
    state.browseMode = "tag";
    const tags = allTags();
    state.selectedTag = tags.some(([tag]) => tag === state.selectedTag)
      ? state.selectedTag
      : tags[0]?.[0] ?? null;
    renderList();
  }

  async function open({ category = "fragment", entryId = null, draft = null } = {}) {
    if (!state.user || state.busy) return;
    showApp(state.user);
    state.browseMode = "category";
    state.selectedCategory = category;
    state.selectedTag = null;
    setBusy(true);
    try {
      if (!state.entriesLoaded) await entries.loadEntries();
      renderList();
      if (entryId) await entries.openEntry(entryId, { force: true });
      else if (draft) entries.beginNewEntry({ category, ...draft });
      else showEmptyEditor();
    } catch (error) {
      handleError(error, "无法读取书桌内容。");
      showEmptyEditor();
    } finally {
      setBusy(false);
    }
  }

  function handleEntrySaved({ entry }) {
    if (state.browseMode === "category") state.selectedCategory = entry.category ?? null;
    renderList();
  }

  function bindEvents() {
    refs.newEntryButton.addEventListener("click", () => entries.beginNewEntry({
      category: state.browseMode === "category" ? state.selectedCategory : "fragment",
    }));
    refs.emptyNewButton.addEventListener("click", () => entries.beginNewEntry({
      category: state.browseMode === "category" ? state.selectedCategory : "fragment",
    }));
    refs.browseCategoryButton.addEventListener("click", () => selectCategory(state.selectedCategory));
    refs.browseTagButton.addEventListener("click", selectTagMode);
    refs.categoryList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (button) selectCategory(button.dataset.category || null);
    });
  }

  return Object.freeze({
    bindEvents,
    handleEntrySaved,
    open,
    renderList,
    selectCategory,
    showEmptyEditor,
  });
}
