import { formatDate } from "./format.js";

export function createWorkbenchFeature({
  state,
  refs,
  setBusy,
  showApp,
  handleError,
  entries,
  topics,
}) {
  function applyModePresentation() {
    const isFragments = state.workbenchMode === "fragments";
    const showJournalNav = isFragments ? state.fragmentDrawerOpen : state.topicDirectoryOpen;
    refs.appView.dataset.workbenchMode = state.workbenchMode;
    refs.appView.dataset.drawerOpen = String(showJournalNav);
    refs.journalNav.hidden = !showJournalNav;
    refs.fragmentTab.setAttribute("aria-pressed", String(isFragments));
    refs.topicTab.setAttribute("aria-pressed", String(!isFragments));
    refs.fragmentDrawerButton.setAttribute("aria-expanded", String(isFragments && state.fragmentDrawerOpen));
    refs.topicTab.setAttribute("aria-expanded", String(!isFragments && state.topicDirectoryOpen));
    refs.newEntryButton.hidden = !isFragments;
    refs.newTopicButton.hidden = isFragments;
    refs.journalListIndex.textContent = isFragments ? "碎片匣" : "主题目录";
    refs.journalListTitle.textContent = isFragments ? "已经留下的纸页" : "正在生长的主题";
    refs.fragmentCount.textContent = String(state.entries.length);
    refs.topicCount.textContent = String(state.topics.length);
  }

  function setFragmentDrawerOpen(open) {
    state.fragmentDrawerOpen = state.workbenchMode === "fragments" && open;
    applyModePresentation();
  }

  function setTopicDirectoryOpen(open) {
    state.topicDirectoryOpen = state.workbenchMode === "topics" && open;
    applyModePresentation();
  }

  function renderList() {
    refs.entryList.replaceChildren();
    const isFragments = state.workbenchMode === "fragments";
    const records = isFragments ? state.entries : state.topics;
    applyModePresentation();
    refs.listEmpty.textContent = isFragments
      ? "碎片匣还是空的。写下第一张纸，它会从这里出现。"
      : "还没有主题拼图。可以先建立一个空主题，再慢慢把碎片放进去。";
    refs.listEmpty.hidden = records.length !== 0;

    for (const entry of records) {
      const listItem = document.createElement("div");
      listItem.setAttribute("role", "listitem");
      const item = document.createElement("button");
      item.type = "button";
      item.className = `entry-list__item${isFragments ? " entry-list__item--fragment" : ""}`;
      item.dataset.entryId = entry.id;
      const currentId = isFragments ? state.current?.id : state.currentTopic?.id;
      item.setAttribute("aria-current", String(currentId === entry.id));

      const title = document.createElement("span");
      title.className = "entry-list__title";
      title.textContent = entry.title || (isFragments ? "没有题目的纸页" : "未命名主题");

      if (isFragments) {
        const seal = document.createElement("span");
        seal.className = "fragment-seal";
        seal.setAttribute("aria-hidden", "true");
        const excerpt = document.createElement("span");
        excerpt.className = "entry-list__excerpt";
        excerpt.textContent = entry.excerpt?.trim() || "这张纸上只留下了一个题目。";
        item.append(seal, title, excerpt);
      } else {
        item.append(title);
      }

      const date = document.createElement("span");
      date.className = "entry-list__date";
      date.textContent = isFragments
        ? formatDate(entry.updated_at)
        : `${entry.fragment_count} 则碎片 · ${formatDate(entry.updated_at)}`;

      item.append(date);
      item.addEventListener("click", () => {
        if (isFragments) {
          setFragmentDrawerOpen(false);
          void entries.openEntry(entry.id);
        } else {
          setTopicDirectoryOpen(false);
          void topics.openTopic(entry.id);
        }
      });
      listItem.append(item);
      refs.entryList.append(listItem);
    }
  }

  function showEmptyEditor() {
    if (state.workbenchMode === "fragments") {
      state.current = null;
      refs.editorEmptyIndex.textContent = "从一则碎片开始";
      refs.editorEmptyTitle.textContent = "今天想留下什么？";
      refs.editorEmptyCopy.textContent = "写下一个片段、一段路途，或某件还没有名字的事。";
      refs.emptyNewButton.textContent = "写一则碎片";
    } else {
      state.currentTopic = null;
      refs.editorEmptyIndex.textContent = "把散落的纸页拼成图案";
      refs.editorEmptyTitle.textContent = "哪些碎片正在谈论同一个问题？";
      refs.editorEmptyCopy.textContent = "先建立一个主题，再从左侧托盘把碎片放进工作台。";
      refs.emptyNewButton.textContent = "开始一幅主题拼图";
    }
    state.dirty = false;
    refs.editorPanel.hidden = true;
    refs.topicPanel.hidden = true;
    refs.editorEmpty.hidden = false;
    renderList();
  }

  async function switchMode(mode) {
    if (!entries.canLeaveCurrentDraft()) {
      return;
    }
    state.workbenchMode = mode;
    state.fragmentDrawerOpen = false;
    state.topicDirectoryOpen = mode === "topics";
    applyModePresentation();
    renderList();

    if (mode === "fragments") {
      entries.beginNewEntry();
      return;
    }

    if (!state.topicsLoaded) {
      setBusy(true);
      try {
        await topics.loadTopics();
      } catch (error) {
        handleError(error, "无法读取主题笔记。");
        showEmptyEditor();
        return;
      } finally {
        setBusy(false);
      }
    }
    if (state.currentTopic?.id) {
      topics.showTopic(state.currentTopic);
    } else if (state.topics[0]) {
      await topics.openTopic(state.topics[0].id);
    } else {
      showEmptyEditor();
    }
  }

  async function open() {
    if (!state.user || state.busy) {
      return;
    }
    showApp(state.user);
    state.workbenchMode = "fragments";
    state.fragmentDrawerOpen = false;
    state.topicDirectoryOpen = false;
    applyModePresentation();
    setBusy(true);
    try {
      await Promise.all([
        state.entriesLoaded ? Promise.resolve() : entries.loadEntries(),
        state.topicsLoaded ? Promise.resolve() : topics.loadTopics(),
      ]);
      entries.beginNewEntry();
    } catch (error) {
      handleError(error, "无法读取写作台内容。");
    } finally {
      setBusy(false);
    }
  }

  async function toggleFragmentDrawer() {
    if (state.workbenchMode !== "fragments") {
      await switchMode("fragments");
      if (state.workbenchMode !== "fragments") return;
    }
    setFragmentDrawerOpen(!state.fragmentDrawerOpen);
  }

  function handleEntrySaved({ created }) {
    if (created) {
      setFragmentDrawerOpen(true);
    }
    renderList();
  }

  function bindEvents() {
    refs.newEntryButton.addEventListener("click", () => {
      setFragmentDrawerOpen(false);
      entries.beginNewEntry();
    });
    refs.newTopicButton.addEventListener("click", () => topics.openTopicDialog());
    refs.emptyNewButton.addEventListener("click", () => {
      if (state.workbenchMode === "fragments") entries.beginNewEntry();
      else topics.openTopicDialog();
    });
    refs.fragmentTab.addEventListener("click", () => void switchMode("fragments"));
    refs.topicTab.addEventListener("click", () => {
      if (state.workbenchMode === "topics") {
        setTopicDirectoryOpen(!state.topicDirectoryOpen);
        return;
      }
      void switchMode("topics");
    });
    refs.fragmentDrawerButton.addEventListener("click", () => void toggleFragmentDrawer());
  }

  return Object.freeze({
    bindEvents,
    handleEntrySaved,
    open,
    renderList,
    setFragmentDrawerOpen,
    setTopicDirectoryOpen,
    showEmptyEditor,
    switchMode,
  });
}
