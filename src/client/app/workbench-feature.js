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
  function renderList() {
    refs.entryList.replaceChildren();
    const isFragments = state.workbenchMode === "fragments";
    const records = isFragments ? state.entries : state.topics;
    refs.listEmpty.textContent = isFragments
      ? "还没有保存的碎片笔记。"
      : "还没有主题笔记。先选择几则碎片，把它们放在一起。";
    refs.listEmpty.hidden = records.length !== 0;

    for (const entry of records) {
      const listItem = document.createElement("div");
      listItem.setAttribute("role", "listitem");
      const item = document.createElement("button");
      item.type = "button";
      item.className = "entry-list__item";
      item.dataset.entryId = entry.id;
      const currentId = isFragments ? state.current?.id : state.currentTopic?.id;
      item.setAttribute("aria-current", String(currentId === entry.id));

      const title = document.createElement("span");
      title.className = "entry-list__title";
      title.textContent = entry.title || (isFragments ? "未命名碎片" : "未命名主题");

      const date = document.createElement("span");
      date.className = "entry-list__date";
      date.textContent = isFragments
        ? formatDate(entry.updated_at)
        : `${entry.fragment_count} 则碎片 · ${formatDate(entry.updated_at)}`;

      item.append(title, date);
      item.addEventListener("click", () => {
        if (isFragments) {
          void entries.openEntry(entry.id);
        } else {
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
      refs.editorEmptyIndex.textContent = "从碎片中发现联系";
      refs.editorEmptyTitle.textContent = "哪些事情似乎在谈论同一个问题？";
      refs.editorEmptyCopy.textContent = "选择至少一则碎片，写下它们之间的关联、矛盾或重复出现的意象。";
      refs.emptyNewButton.textContent = "整理第一则主题";
    }
    state.dirty = false;
    refs.editorPanel.hidden = true;
    refs.topicPanel.hidden = true;
    refs.editorEmpty.hidden = false;
    renderList();
  }

  async function switchMode(mode) {
    if (mode === state.workbenchMode || !entries.canLeaveCurrentDraft()) {
      return;
    }
    state.workbenchMode = mode;
    refs.fragmentTab.setAttribute("aria-pressed", String(mode === "fragments"));
    refs.topicTab.setAttribute("aria-pressed", String(mode === "topics"));
    refs.newEntryButton.hidden = mode !== "fragments";
    refs.newTopicButton.hidden = mode !== "topics";
    renderList();

    if (mode === "fragments") {
      if (state.current?.id) {
        entries.showEditor(state.current);
      } else if (state.entries[0]) {
        await entries.openEntry(state.entries[0].id, { force: true });
      } else {
        showEmptyEditor();
      }
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
    refs.fragmentTab.setAttribute("aria-pressed", String(state.workbenchMode === "fragments"));
    refs.topicTab.setAttribute("aria-pressed", String(state.workbenchMode === "topics"));
    refs.newEntryButton.hidden = state.workbenchMode !== "fragments";
    refs.newTopicButton.hidden = state.workbenchMode !== "topics";
    setBusy(true);
    try {
      if (!state.entriesLoaded) {
        await entries.loadEntries();
      }
      if (state.workbenchMode === "topics") {
        if (!state.topicsLoaded) await topics.loadTopics();
        if (state.currentTopic?.id) {
          topics.showTopic(state.currentTopic);
        } else if (state.topics[0]) {
          await topics.openTopic(state.topics[0].id, { force: true });
        } else {
          showEmptyEditor();
        }
      } else if (state.current?.id) {
        entries.showEditor(state.current);
      } else if (state.entries[0]) {
        await entries.openEntry(state.entries[0].id, { force: true });
      } else {
        showEmptyEditor();
      }
    } catch (error) {
      handleError(error, "无法读取写作台内容。");
    } finally {
      setBusy(false);
    }
  }

  function bindEvents() {
    refs.newEntryButton.addEventListener("click", entries.beginNewEntry);
    refs.newTopicButton.addEventListener("click", () => topics.openTopicDialog());
    refs.emptyNewButton.addEventListener("click", () => {
      if (state.workbenchMode === "fragments") entries.beginNewEntry();
      else topics.openTopicDialog();
    });
    refs.fragmentTab.addEventListener("click", () => void switchMode("fragments"));
    refs.topicTab.addEventListener("click", () => void switchMode("topics"));
  }

  return Object.freeze({ bindEvents, open, renderList, showEmptyEditor, switchMode });
}
