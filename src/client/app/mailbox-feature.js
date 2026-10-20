import { formatDate } from "./format.js";

export function createMailboxFeature({
  state,
  refs,
  api,
  vault,
  setBusy,
  showMailboxView,
  openDesk,
  showMessage,
  handleError,
  canLeaveCurrentDraft,
  onSent = () => {},
}) {
  function renderBody(content) {
    refs.mailReaderContent.replaceChildren();
    for (const paragraph of String(content ?? "").split(/\n{2,}/u)) {
      if (!paragraph.trim()) continue;
      const element = document.createElement("p");
      element.textContent = paragraph.trim();
      refs.mailReaderContent.append(element);
    }
  }

  function renderList() {
    const records = state.sentLetters;
    refs.inboxTab.setAttribute("aria-selected", "false");
    refs.sentTab.setAttribute("aria-selected", "true");
    refs.mailList.replaceChildren();
    refs.mailListEmpty.textContent = "还没有寄出过信。";
    refs.mailListEmpty.hidden = records.length !== 0;

    for (const letter of records) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "mail-list__item";
      item.setAttribute("role", "listitem");
      item.setAttribute("aria-current", String(state.currentSentLetter?.id === letter.id));
      const marker = document.createElement("span");
      marker.className = "mail-list__marker";
      marker.textContent = "寄";
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      title.dataset.i18nSkip = "";
      title.textContent = letter.title;
      const meta = document.createElement("small");
      meta.textContent = `寄给 ${letter.recipient || "未署名收信人"} · ${formatDate(letter.sent_at)}`;
      copy.append(title, meta);
      item.append(marker, copy);
      item.addEventListener("click", () => {
        if (state.busy) return;
        showSent(letter);
      });
      refs.mailList.append(item);
    }
  }

  function showSent(letter) {
    state.currentSentLetter = letter;
    state.currentIncomingLetter = null;
    refs.mailEmpty.hidden = true;
    refs.mailReader.hidden = false;
    refs.mailReaderMeta.textContent = `寄出于 ${formatDate(letter.sent_at)}`;
    refs.mailReaderTitle.textContent = letter.title;
    refs.mailReaderParty.textContent = `To: ${letter.recipient || "未署名收信人"}`;
    refs.mailReaderAction.textContent = "由此建立新草稿";
    refs.editSentLetterButton.hidden = false;
    refs.deleteSentLetterButton.hidden = false;
    renderBody(letter.body);
    renderList();
  }

  function showEmpty() {
    state.currentIncomingLetter = null;
    state.currentSentLetter = null;
    refs.mailReader.hidden = true;
    refs.mailEmpty.hidden = false;
    refs.editSentLetterButton.hidden = true;
    refs.deleteSentLetterButton.hidden = true;
    renderList();
  }

  function setEditSentLetterError(message = "") {
    refs.editSentLetterError.textContent = message;
    refs.editSentLetterError.hidden = !message;
  }

  function openEditSentLetter() {
    const letter = state.currentSentLetter;
    if (!letter || state.busy) return;
    setEditSentLetterError();
    refs.editSentLetterTitle.value = letter.title ?? "";
    refs.editSentLetterRecipient.value = letter.recipient ?? "";
    refs.editSentLetterBody.value = letter.body ?? "";
    refs.editSentLetterDialog.showModal();
    refs.editSentLetterTitle.focus();
  }

  async function saveEditedSentLetter(event) {
    event.preventDefault();
    const letterId = state.currentSentLetter?.id;
    if (!letterId || state.busy) return;
    const recipient = refs.editSentLetterRecipient.value.trim();
    if (!recipient) {
      setEditSentLetterError("请填写收信人。");
      refs.editSentLetterRecipient.focus();
      return;
    }
    setBusy(true);
    setEditSentLetterError();
    try {
      const sealedPayload = await vault.seal("sent-letter", letterId, {
        title: refs.editSentLetterTitle.value.trim(),
        recipient,
        body: refs.editSentLetterBody.value,
      });
      const data = await api(`/api/sent-letters/${letterId}`, {
        method: "PUT",
        body: JSON.stringify({ sealed_payload: sealedPayload }),
      });
      const letter = await vault.openSentLetter(data.letter);
      const index = state.sentLetters.findIndex((candidate) => candidate.id === letterId);
      if (index >= 0) state.sentLetters[index] = letter;
      else state.sentLetters.unshift(letter);
      refs.editSentLetterDialog.close();
      showSent(letter);
      showMessage("寄件记录已经更新。");
    } catch (error) {
      setEditSentLetterError(error instanceof Error ? error.message : "无法保存这封寄件记录。");
      handleError(error, "无法保存这封寄件记录。");
    } finally {
      setBusy(false);
    }
  }

  async function removeCurrentSentLetter() {
    const letterId = state.currentSentLetter?.id;
    if (!letterId || state.busy) return;
    const currentIndex = state.sentLetters.findIndex((letter) => letter.id === letterId);
    setBusy(true);
    try {
      await api(`/api/sent-letters/${letterId}`, { method: "DELETE" });
      state.sentLetters = state.sentLetters.filter((letter) => letter.id !== letterId);
      state.currentSentLetter = null;
      const nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex, state.sentLetters.length - 1);
      const nextLetter = state.sentLetters[nextIndex];
      if (nextLetter) showSent(nextLetter);
      else showEmpty();
      showMessage("寄件记录已经删除，现实中的寄送不会受到影响。");
    } catch (error) {
      handleError(error, "无法删除这封寄件记录。");
    } finally {
      setBusy(false);
    }
  }

  async function loadSent() {
    const data = await api("/api/sent-letters");
    state.sentLetters = await Promise.all(data.letters.map((letter) => vault.openSentLetter(letter)));
    state.sentLettersLoaded = true;
  }

  async function open({ letterId = null } = {}) {
    if (!state.user || state.busy || !canLeaveCurrentDraft()) return;
    showMailboxView();
    state.mailboxMode = "sent";
    setBusy(true);
    try {
      if (!state.sentLettersLoaded) await loadSent();
      renderList();
      const letter = state.sentLetters.find((candidate) => candidate.id === letterId)
        ?? state.sentLetters[0];
      if (letter) showSent(letter);
      else showEmpty();
    } catch (error) {
      handleError(error, "无法读取信箱。");
      showEmpty();
    } finally {
      setBusy(false);
    }
  }

  async function writeLetter() {
    await openDesk({
      category: "letter",
      draft: { title: "", recipient: "", body: "", tags: [] },
    });
  }

  async function answerCurrent() {
    if (state.currentSentLetter) {
      await openDesk({
        category: "letter",
        draft: {
          title: state.currentSentLetter.title,
          recipient: state.currentSentLetter.recipient,
          body: state.currentSentLetter.body,
        },
      });
    }
  }

  async function sendDraft(entry) {
    if (!entry?.id || entry.category !== "letter" || state.busy) return;
    if (!entry.recipient?.trim()) {
      showMessage("先为这封信写下收信人。", "error");
      refs.entryRecipient.focus();
      return;
    }
    setBusy(true);
    let sentLetterId = null;
    try {
      const id = crypto.randomUUID();
      const sealedPayload = await vault.seal("sent-letter", id, {
        title: entry.title,
        recipient: entry.recipient,
        body: entry.body,
      });
      const data = await api("/api/sent-letters", {
        method: "POST",
        body: JSON.stringify({ id, source_entry_id: entry.id, sealed_payload: sealedPayload }),
      });
      const letter = await vault.openSentLetter(data.letter);
      sentLetterId = letter.id;
      state.sentLettersLoaded = false;
      showMessage("信已经寄出，并作为寄件记录放进寄件箱。");
    } catch (error) {
      handleError(error, "无法寄出这封信。");
    } finally {
      setBusy(false);
    }
    if (sentLetterId) {
      await open({ mode: "sent", letterId: sentLetterId });
      onSent(state.currentSentLetter);
    }
  }

  function bindEvents() {
    refs.writeLetterButton.addEventListener("click", () => void writeLetter());
    refs.sentTab.addEventListener("click", () => void open());
    refs.mailReaderAction.addEventListener("click", () => void answerCurrent());
    refs.editSentLetterButton.addEventListener("click", openEditSentLetter);
    refs.deleteSentLetterButton.addEventListener("click", () => {
      if (state.currentSentLetter && !state.busy) refs.deleteSentLetterDialog.showModal();
    });
    refs.editSentLetterForm.addEventListener("submit", (event) => void saveEditedSentLetter(event));
    refs.cancelEditSentLetter.addEventListener("click", () => refs.editSentLetterDialog.close());
    refs.confirmDeleteSentLetter.addEventListener("click", () => void removeCurrentSentLetter());
  }

  return Object.freeze({ bindEvents, open, sendDraft, writeLetter });
}
