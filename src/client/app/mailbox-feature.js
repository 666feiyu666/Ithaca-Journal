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
    const inbox = state.mailboxMode === "inbox";
    const records = inbox ? state.letters : state.sentLetters;
    refs.inboxTab.setAttribute("aria-selected", String(inbox));
    refs.sentTab.setAttribute("aria-selected", String(!inbox));
    refs.mailList.replaceChildren();
    refs.mailListEmpty.textContent = inbox ? "还没有信抵达。" : "还没有寄出过信。";
    refs.mailListEmpty.hidden = records.length !== 0;

    for (const letter of records) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "mail-list__item";
      item.setAttribute("role", "listitem");
      const activeId = inbox ? state.currentIncomingLetter?.day : state.currentSentLetter?.id;
      const recordId = inbox ? letter.day : letter.id;
      item.setAttribute("aria-current", String(activeId === recordId));
      const marker = document.createElement("span");
      marker.className = "mail-list__marker";
      marker.textContent = inbox && !letter.opened_at ? "新" : (inbox ? `D${letter.day}` : "寄");
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      title.dataset.i18nSkip = "";
      title.textContent = letter.title;
      const meta = document.createElement("small");
      meta.textContent = inbox
        ? `${letter.sender}${letter.current ? " · 今日" : ""}`
        : `寄给 ${letter.recipient || "未署名收信人"} · ${formatDate(letter.sent_at)}`;
      copy.append(title, meta);
      item.append(marker, copy);
      item.addEventListener("click", () => {
        if (inbox) void openIncoming(letter.day);
        else showSent(letter);
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
    renderBody(letter.body);
    renderList();
  }

  function showIncoming(letter) {
    state.currentIncomingLetter = letter;
    state.currentSentLetter = null;
    refs.mailEmpty.hidden = true;
    refs.mailReader.hidden = false;
    refs.mailReaderMeta.textContent = `第 ${letter.day} 天来信`;
    refs.mailReaderTitle.textContent = letter.title;
    refs.mailReaderParty.textContent = `From: ${letter.sender}`;
    refs.mailReaderAction.textContent = "回信";
    renderBody(letter.content);
    renderList();
  }

  function showEmpty() {
    state.currentIncomingLetter = null;
    state.currentSentLetter = null;
    refs.mailReader.hidden = true;
    refs.mailEmpty.hidden = false;
    renderList();
  }

  async function loadInbox() {
    const data = await api("/api/letters");
    state.letters = data.letters;
  }

  async function loadSent() {
    const data = await api("/api/sent-letters");
    state.sentLetters = await Promise.all(data.letters.map((letter) => vault.openSentLetter(letter)));
    state.sentLettersLoaded = true;
  }

  async function openIncoming(day) {
    if (state.busy) return;
    setBusy(true);
    try {
      const data = await api(`/api/letters/${day}/open`, { method: "PUT" });
      const summary = state.letters.find((letter) => letter.day === day);
      if (summary) summary.opened_at = data.letter.opened_at;
      showIncoming(data.letter);
    } catch (error) {
      handleError(error, "无法打开这封来信。");
    } finally {
      setBusy(false);
    }
  }

  async function open({ mode = "inbox", letterId = null } = {}) {
    if (!state.user || state.busy || !canLeaveCurrentDraft()) return;
    showMailboxView();
    state.mailboxMode = mode;
    setBusy(true);
    try {
      await Promise.all([
        loadInbox(),
        state.sentLettersLoaded ? Promise.resolve() : loadSent(),
      ]);
      renderList();
      if (mode === "sent") {
        const letter = state.sentLetters.find((candidate) => candidate.id === letterId)
          ?? state.sentLetters[0];
        if (letter) showSent(letter);
        else showEmpty();
      } else if (state.letters.length) {
        const day = state.journey?.current_day ?? state.letters.at(-1).day;
        const data = await api(`/api/letters/${day}/open`, { method: "PUT" });
        const summary = state.letters.find((letter) => letter.day === day);
        if (summary) summary.opened_at = data.letter.opened_at;
        showIncoming(data.letter);
      } else {
        showEmpty();
      }
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
    if (state.mailboxMode === "inbox" && state.currentIncomingLetter) {
      const source = state.currentIncomingLetter;
      await openDesk({
        category: "letter",
        draft: {
          title: `回：${source.title}`,
          recipient: source.sender,
          body: "",
          source_letter_day: source.day,
        },
      });
      return;
    }
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
      showMessage("信已经寄出，并作为快照放进寄件箱。");
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
    refs.inboxTab.addEventListener("click", () => void open({ mode: "inbox" }));
    refs.sentTab.addEventListener("click", () => void open({ mode: "sent" }));
    refs.mailReaderAction.addEventListener("click", () => void answerCurrent());
  }

  return Object.freeze({ bindEvents, open, sendDraft, writeLetter });
}
