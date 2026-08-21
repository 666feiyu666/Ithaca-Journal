import { formatDate } from "./format.js";

export function createTopicsFeature({
  state,
  refs,
  api,
  setBusy,
  renderList,
  showEmptyEditor,
  showMessage,
  handleError,
  canLeaveCurrentDraft,
}) {
  function setTopicFormError(message = "") {
    refs.topicFormError.textContent = message;
    refs.topicFormError.hidden = !message;
  }

  function showTopic(topic) {
    state.currentTopic = topic;
    state.dirty = false;
    refs.editorEmpty.hidden = true;
    refs.editorPanel.hidden = true;
    refs.topicPanel.hidden = false;
    window.scrollTo({ top: 0, left: 0 });
    refs.topicPanel.parentElement.scrollTop = 0;
    refs.topicDate.textContent = `最近整理：${formatDate(topic.updated_at)}`;
    refs.topicTitle.textContent = topic.title;
    refs.topicBody.textContent = topic.body || "这则主题暂时只有被选中的碎片，还没有写下解释。";
    refs.topicSourceList.replaceChildren();
    for (const fragment of topic.fragments) {
      const source = document.createElement("article");
      source.className = "topic-source";
      const title = document.createElement("h4");
      title.textContent = fragment.title;
      const body = document.createElement("p");
      body.textContent = fragment.body || "（这则碎片没有正文。）";
      source.append(title, body);
      refs.topicSourceList.append(source);
    }
    renderList();
  }

  async function loadTopics() {
    const data = await api("/api/topics");
    state.topics = data.topics;
    state.topicsLoaded = true;
    renderList();
  }

  async function openTopic(topicId, { force = false } = {}) {
    if (!force && (state.busy || !canLeaveCurrentDraft())) {
      return;
    }
    setBusy(true);
    try {
      const data = await api(`/api/topics/${topicId}`);
      showTopic(data.topic);
    } catch (error) {
      handleError(error, "无法打开这则主题笔记。");
    } finally {
      setBusy(false);
    }
  }

  function renderTopicFragmentOptions(selectedIds = []) {
    const selected = new Set(selectedIds);
    refs.topicFragmentOptions.replaceChildren();
    for (const fragment of state.entries) {
      const label = document.createElement("label");
      label.className = "source-picker__option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "topic-fragment";
      input.value = fragment.id;
      input.checked = selected.has(fragment.id);
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = fragment.title;
      const date = document.createElement("small");
      date.textContent = formatDate(fragment.updated_at);
      copy.append(title, date);
      label.append(input, copy);
      refs.topicFragmentOptions.append(label);
    }
  }

  function openTopicDialog(topic = null) {
    if (!state.entries.length) {
      showMessage("先写下一则碎片，再开始整理主题。", "error");
      return;
    }
    setTopicFormError();
    refs.topicDialogTitle.textContent = topic ? "调整这则主题" : "把碎片放在一起";
    refs.topicId.value = topic?.id ?? "";
    refs.topicTitleInput.value = topic?.title ?? "";
    refs.topicBodyInput.value = topic?.body ?? "";
    renderTopicFragmentOptions(topic?.fragments?.map((fragment) => fragment.id) ?? []);
    refs.topicDialog.showModal();
    refs.topicTitleInput.focus();
  }

  async function saveTopic(event) {
    event.preventDefault();
    if (state.busy) return;
    const fragmentIds = [...refs.topicFragmentOptions.querySelectorAll("input:checked")].map(
      (input) => input.value,
    );
    if (!fragmentIds.length) {
      setTopicFormError("请至少选择一则碎片笔记。");
      return;
    }

    setBusy(true);
    setTopicFormError();
    const topicId = refs.topicId.value;
    try {
      const data = await api(topicId ? `/api/topics/${topicId}` : "/api/topics", {
        method: topicId ? "PUT" : "POST",
        body: JSON.stringify({
          title: refs.topicTitleInput.value,
          body: refs.topicBodyInput.value,
          fragment_ids: fragmentIds,
        }),
      });
      refs.topicDialog.close();
      state.workbenchMode = "topics";
      state.currentTopic = data.topic;
      await loadTopics();
      showTopic(data.topic);
      showMessage(topicId ? "主题已经更新。" : "主题已经建立，可以继续编纂成书。 ");
    } catch (error) {
      setTopicFormError(error instanceof Error ? error.message : "无法保存主题。");
    } finally {
      setBusy(false);
    }
  }

  async function removeCurrentTopic() {
    if (!state.currentTopic?.id || state.busy) return;
    const topicId = state.currentTopic.id;
    setBusy(true);
    try {
      await api(`/api/topics/${topicId}`, { method: "DELETE" });
      state.currentTopic = null;
      await loadTopics();
      if (state.topics[0]) {
        const data = await api(`/api/topics/${state.topics[0].id}`);
        showTopic(data.topic);
      } else {
        showEmptyEditor();
      }
      showMessage("主题已经删除，原始碎片仍然保留。 ");
    } catch (error) {
      handleError(error, "无法删除这则主题。");
    } finally {
      setBusy(false);
    }
  }

  function bindEvents() {
    refs.editTopicButton.addEventListener("click", () => openTopicDialog(state.currentTopic));
    refs.deleteTopicButton.addEventListener("click", () => refs.deleteTopicDialog.showModal());
    refs.confirmDeleteTopic.addEventListener("click", () => void removeCurrentTopic());
    refs.topicForm.addEventListener("submit", (event) => void saveTopic(event));
    refs.cancelTopic.addEventListener("click", () => refs.topicDialog.close());
  }

  return Object.freeze({
    bindEvents,
    loadTopics,
    openTopic,
    openTopicDialog,
    showTopic,
  });
}
