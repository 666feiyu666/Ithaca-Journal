import { formatDate } from "./format.js";
import { formatDayTime, groupEntriesByCreationDay } from "./timeline.js";

export const CATEGORY_LABELS = Object.freeze({
  "": "未分类",
  fragment: "碎片",
  theme: "主题",
  letter: "书信",
  book: "书籍",
  journal: "日记",
});

const ARCHIVED_CATEGORIES = new Set(["theme", "letter", "book", "journal"]);
const EDIT_TOLERANCE_MS = 60_000;

export function normalizedTags(value) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(/[，,、]/u);
  return [...new Set(source.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 20);
}

export function entriesForBrowse(entries, { mode, category, tag }) {
  if (mode === "all") return [...entries];
  if (mode === "tag") {
    return tag ? entries.filter((entry) => normalizedTags(entry.tags).includes(tag)) : [];
  }
  const selected = category || null;
  return entries.filter((entry) => (entry.category ?? null) === selected);
}

function wasEditedLater(entry) {
  const created = new Date(entry?.created_at ?? 0).getTime();
  const updated = new Date(entry?.updated_at ?? 0).getTime();
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return false;
  return updated - created > EDIT_TOLERANCE_MS;
}

export function createWorkbenchFeature({
  state,
  refs,
  setBusy,
  showApp,
  handleError,
  entries,
  getLocale = () => "zh-CN",
}) {
  let previousView = state.view;

  function locale() {
    return getLocale() === "en" ? "en" : "zh-CN";
  }

  function scrollContainer() {
    return refs.deskStage ?? refs.editorPanel?.parentElement ?? null;
  }

  function recordFeedPosition() {
    const container = scrollContainer();
    if (container) state.feedScrollTop = container.scrollTop;
  }

  function restoreFeedPosition() {
    const container = scrollContainer();
    if (!container) return;
    const top = state.feedScrollTop;
    const apply = () => { container.scrollTop = top; };
    apply();
    globalThis.requestAnimationFrame?.(apply);
  }

  function allTags() {
    const counts = new Map();
    for (const entry of state.entries) {
      for (const tag of normalizedTags(entry.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right, "zh-CN"));
  }

  function renderFilters() {
    const mode = state.browseMode;
    refs.browseAllButton.setAttribute("aria-current", String(mode === "all"));
    refs.browseAllCount.textContent = String(state.entries.length);

    for (const button of refs.categoryList.querySelectorAll("[data-category]")) {
      const category = button.dataset.category || null;
      const active = mode === "category" && (state.selectedCategory || null) === category;
      button.setAttribute("aria-current", String(active));
      const count = state.entries.filter((entry) => (entry.category ?? null) === category).length;
      button.querySelector("small").textContent = String(count);
    }

    const tags = allTags();
    refs.tagList.replaceChildren();
    refs.tagListEmpty.hidden = tags.length !== 0;
    for (const [tag, count] of tags) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-current", String(mode === "tag" && tag === state.selectedTag));
      const label = document.createElement("span");
      label.textContent = `# ${tag}`;
      const total = document.createElement("small");
      total.textContent = String(count);
      button.append(label, total);
      button.addEventListener("click", () => {
        state.browseMode = "tag";
        state.selectedTag = tag;
        state.selectedCategory = null;
        renderList();
      });
      refs.tagList.append(button);
    }
  }

  function currentHeading() {
    if (state.browseMode === "all") return "所有纸页";
    if (state.browseMode === "tag") return state.selectedTag ? `# ${state.selectedTag}` : "标签";
    return CATEGORY_LABELS[state.selectedCategory ?? ""];
  }

  function emptyCopy() {
    if (state.browseMode === "tag") {
      return state.selectedTag ? `标签 # ${state.selectedTag} 下还没有纸页。` : "还没有纸页。";
    }
    if (state.browseMode === "category") {
      return `${CATEGORY_LABELS[state.selectedCategory ?? ""]}里还没有纸页。`;
    }
    return "书桌还空着。写下第一句话，它就会出现在今天。";
  }

  function appendMeta(item, entry) {
    const meta = document.createElement("div");
    meta.className = "feed-item__meta";
    meta.dataset.i18nSkip = "";
    const category = entry.category ?? "";
    if (ARCHIVED_CATEGORIES.has(category)) {
      const marker = document.createElement("span");
      marker.className = `paper-category paper-category--${category}`;
      marker.textContent = CATEGORY_LABELS[category];
      meta.append(marker);
    }
    const time = document.createElement("span");
    time.className = "feed-item__time";
    time.textContent = formatDayTime(entry.created_at ?? entry.updated_at, locale());
    meta.append(time);
    if (wasEditedLater(entry)) {
      const edited = document.createElement("span");
      edited.className = "feed-item__edited";
      edited.textContent = `编辑于 ${formatDate(entry.updated_at)}`;
      meta.append(edited);
    }
    const tags = normalizedTags(entry.tags);
    if (tags.length) {
      const tagRow = document.createElement("span");
      tagRow.className = "feed-item__tags";
      tagRow.textContent = tags.map((tag) => `#${tag}`).join("  ");
      meta.append(tagRow);
    }
    item.append(meta);
  }

  function renderFeedItem(entry) {
    const item = document.createElement("article");
    item.className = "feed-item";

    const open = document.createElement("button");
    open.type = "button";
    open.className = "feed-item__open";
    open.setAttribute("role", "listitem");
    open.setAttribute("aria-current", String(state.current?.id === entry.id));

    const title = String(entry.title ?? "").trim();
    const body = String(entry.body ?? entry.excerpt ?? "").trim();
    if (title) {
      const heading = document.createElement("span");
      heading.className = "feed-item__title";
      heading.dataset.i18nSkip = "";
      heading.textContent = title;
      open.append(heading);
    }
    const lead = document.createElement("span");
    lead.className = title ? "feed-item__excerpt" : "feed-item__lead";
    lead.dataset.i18nSkip = "";
    lead.textContent = body || (title ? "" : "这张纸只留下了标签。");
    lead.hidden = !lead.textContent;
    open.append(lead);

    const visible = open.textContent.trim();
    if (!visible) {
      const placeholder = document.createElement("span");
      placeholder.className = "feed-item__excerpt";
      placeholder.textContent = "这张纸还没有写下内容。";
      open.append(placeholder);
    }

    item.append(open);
    appendMeta(item, entry);
    open.addEventListener("click", () => {
      recordFeedPosition();
      void entries.openEntry(entry.id);
    });
    return item;
  }

  function renderFeed(records) {
    refs.entryFeed.replaceChildren();
    const groups = groupEntriesByCreationDay(records, { locale: locale() });
    refs.feedHeading.textContent = currentHeading();
    refs.entryResultCount.textContent = `${records.length} 张`;
    refs.listEmpty.textContent = emptyCopy();
    refs.listEmpty.hidden = records.length !== 0;
    for (const group of groups) {
      const section = document.createElement("section");
      section.className = "feed-day";
      const heading = document.createElement("h2");
      heading.className = "feed-day__label";
      heading.dataset.i18nSkip = "";
      heading.textContent = group.label;
      section.append(heading);
      for (const entry of group.entries) section.append(renderFeedItem(entry));
      refs.entryFeed.append(section);
    }
  }

  function syncDeskView() {
    const page = state.view === "page";
    if (refs.deskStage) refs.deskStage.dataset.view = state.view;
    refs.entryFeed.hidden = page;
    refs.listEmpty.hidden = page || refs.listEmpty.hidden;
    refs.feedHeadingRow.hidden = page;
    refs.backToFeedButton.hidden = !page;
    refs.draftBanner.hidden = page || !state.draft || state.draftActive;
  }

  function renderList() {
    renderFilters();
    const records = entriesForBrowse(state.entries, {
      mode: state.browseMode,
      category: state.selectedCategory,
      tag: state.selectedTag,
    });
    renderFeed(records);
    syncDeskView();
    if (previousView === "page" && state.view === "desk") restoreFeedPosition();
    previousView = state.view;
  }

  function selectAllPages() {
    state.browseMode = "all";
    state.selectedCategory = null;
    state.selectedTag = null;
    renderList();
  }

  function selectCategory(category) {
    state.browseMode = "category";
    state.selectedCategory = category || null;
    state.selectedTag = null;
    renderList();
  }

  function handleEntrySaved() {
    renderList();
  }

  function toggleFilterPanel() {
    state.filterPanelOpen = !state.filterPanelOpen;
    refs.filterToggleButton.setAttribute("aria-expanded", String(state.filterPanelOpen));
    refs.filterBody.dataset.collapsed = String(!state.filterPanelOpen);
  }

  async function open({ category = null, entryId = null, draft = null } = {}) {
    if (!state.user || state.busy) return;
    showApp(state.user);
    if (category) {
      state.browseMode = "category";
      state.selectedCategory = category;
      state.selectedTag = null;
    }
    setBusy(true);
    try {
      if (!state.entriesLoaded) await entries.loadEntries();
      if (entryId) {
        state.view = "page";
        await entries.openEntry(entryId, { force: true });
      } else if (draft) {
        entries.beginNewEntry({ category: category ?? "fragment", ...draft }, { expanded: true });
      } else {
        await entries.loadStoredDraft();
        entries.beginNewEntry();
      }
    } catch (error) {
      handleError(error, "无法读取书桌内容。");
      renderList();
    } finally {
      setBusy(false);
    }
  }

  async function resumeDraft() {
    await entries.resumeDraft();
    renderList();
  }

  async function discardDraft() {
    await entries.discardDraft();
    renderList();
  }

  function bindEvents() {
    refs.browseAllButton.addEventListener("click", selectAllPages);
    refs.categoryList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (button) selectCategory(button.dataset.category || null);
    });
    refs.newEntryButton.addEventListener("click", () => {
      refs.editorPanel.parentElement.scrollTop = 0;
      entries.beginNewEntry();
    });
    refs.listEmptyNewButton?.addEventListener("click", () => entries.beginNewEntry());
    refs.backToFeedButton.addEventListener("click", () => entries.collapseEditor());
    refs.draftResumeButton.addEventListener("click", () => void resumeDraft());
    refs.draftDiscardButton.addEventListener("click", () => void discardDraft());
    refs.filterToggleButton.addEventListener("click", toggleFilterPanel);
    refs.filterBody.dataset.collapsed = String(!state.filterPanelOpen);
  }

  return Object.freeze({
    bindEvents,
    handleEntrySaved,
    open,
    renderList,
    selectAllPages,
    selectCategory,
  });
}
