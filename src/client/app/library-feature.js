import { formatDate } from "./format.js";

export function createLibraryFeature({
  state,
  refs,
  api,
  setBusy,
  showMessage,
  handleError,
  canLeaveCurrentDraft,
  loadTopics,
}) {
  function setCompileBookError(message = "") {
    refs.compileBookError.textContent = message;
    refs.compileBookError.hidden = !message;
  }

  function showBooksView() {
    if (!state.user) return;
    refs.authView.hidden = true;
    refs.titleView.hidden = true;
    refs.sceneView.hidden = true;
    refs.appView.hidden = true;
    refs.booksView.hidden = false;
    window.scrollTo({ top: 0, left: 0 });
    refs.booksEmail.textContent = state.user.email;
  }

  function renderBookList() {
    refs.bookList.replaceChildren();
    refs.bookListEmpty.hidden = state.books.length !== 0;
    for (const book of state.books) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "book-list__item";
      item.setAttribute("role", "listitem");
      item.setAttribute("aria-current", String(state.currentBook?.id === book.id));
      const title = document.createElement("strong");
      title.textContent = book.title;
      const date = document.createElement("small");
      date.textContent = formatDate(book.created_at);
      item.append(title, date);
      item.addEventListener("click", () => void openBook(book.id));
      refs.bookList.append(item);
    }
  }

  function renderBookContent(content) {
    refs.bookContent.replaceChildren();
    let skippedBookTitle = false;
    for (const line of content.split("\n")) {
      let element;
      if (line.startsWith("### ")) {
        element = document.createElement("h3");
        element.textContent = line.slice(4);
      } else if (line.startsWith("## ")) {
        element = document.createElement("h2");
        element.textContent = line.slice(3);
      } else if (line.startsWith("# ")) {
        if (!skippedBookTitle) {
          skippedBookTitle = true;
          continue;
        }
        element = document.createElement("h1");
        element.textContent = line.slice(2);
      } else if (line === "---") {
        element = document.createElement("hr");
      } else if (line.trim()) {
        element = document.createElement("p");
        element.textContent = line;
      } else {
        continue;
      }
      refs.bookContent.append(element);
    }
  }

  function showBook(book) {
    state.currentBook = book;
    refs.bookEmpty.hidden = true;
    refs.bookReader.hidden = false;
    window.scrollTo({ top: 0, left: 0 });
    refs.bookReader.parentElement.scrollTop = 0;
    refs.bookDate.textContent = formatDate(book.created_at);
    refs.bookTitle.textContent = book.title;
    renderBookContent(book.content_snapshot);
    renderBookList();
  }

  function showEmptyBook() {
    state.currentBook = null;
    refs.bookReader.hidden = true;
    refs.bookEmpty.hidden = false;
    renderBookList();
  }

  async function loadBooks() {
    const data = await api("/api/books");
    state.books = data.books;
    state.booksLoaded = true;
    renderBookList();
  }

  async function openBook(bookId) {
    if (state.busy) return;
    setBusy(true);
    try {
      const data = await api(`/api/books/${bookId}`);
      showBook(data.book);
    } catch (error) {
      handleError(error, "无法打开这本书。");
    } finally {
      setBusy(false);
    }
  }

  async function open() {
    if (!state.user || state.busy || !canLeaveCurrentDraft()) return;
    showBooksView();
    setBusy(true);
    try {
      await Promise.all([
        state.booksLoaded ? Promise.resolve() : loadBooks(),
        state.topicsLoaded ? Promise.resolve() : loadTopics(),
      ]);
      if (state.currentBook?.id) {
        showBook(state.currentBook);
      } else if (state.books[0]) {
        const data = await api(`/api/books/${state.books[0].id}`);
        showBook(data.book);
      } else {
        showEmptyBook();
      }
    } catch (error) {
      handleError(error, "无法读取书架。");
      showEmptyBook();
    } finally {
      setBusy(false);
    }
  }

  function renderBookTopicOptions() {
    refs.bookTopicOptions.replaceChildren();
    for (const topic of state.topics) {
      const label = document.createElement("label");
      label.className = "source-picker__option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "book-topic";
      input.value = topic.id;
      input.disabled = topic.fragment_count === 0;
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = topic.title;
      const count = document.createElement("small");
      count.textContent = topic.fragment_count === 0
        ? "画布为空，暂不能编纂"
        : `${topic.fragment_count} 则碎片`;
      copy.append(title, count);
      label.append(input, copy);
      refs.bookTopicOptions.append(label);
    }
  }

  async function openCompileBookDialog() {
    if (!state.topicsLoaded) {
      setBusy(true);
      try {
        await loadTopics();
      } catch (error) {
        handleError(error, "无法读取主题笔记。");
        return;
      } finally {
        setBusy(false);
      }
    }
    if (!state.topics.some((topic) => topic.fragment_count > 0)) {
      showMessage("先为至少一则主题放入碎片，再开始编纂。", "error");
      return;
    }
    setCompileBookError();
    refs.bookTitleInput.value = "";
    refs.bookPrefaceInput.value = "";
    renderBookTopicOptions();
    refs.compileBookDialog.showModal();
    refs.bookTitleInput.focus();
  }

  async function compileBook(event) {
    event.preventDefault();
    if (state.busy) return;
    const topicIds = [...refs.bookTopicOptions.querySelectorAll("input:checked")].map(
      (input) => input.value,
    );
    if (!topicIds.length) {
      setCompileBookError("请至少选择一则主题笔记。");
      return;
    }
    setBusy(true);
    setCompileBookError();
    try {
      const data = await api("/api/books", {
        method: "POST",
        body: JSON.stringify({
          title: refs.bookTitleInput.value,
          preface: refs.bookPrefaceInput.value,
          topic_ids: topicIds,
        }),
      });
      refs.compileBookDialog.close();
      state.currentBook = data.book;
      await loadBooks();
      showBooksView();
      showBook(data.book);
      showMessage("新书已经装订并放上书架。 ");
    } catch (error) {
      setCompileBookError(error instanceof Error ? error.message : "无法完成编纂。");
    } finally {
      setBusy(false);
    }
  }

  async function removeCurrentBook() {
    if (!state.currentBook?.id || state.busy) return;
    const bookId = state.currentBook.id;
    setBusy(true);
    try {
      await api(`/api/books/${bookId}`, { method: "DELETE" });
      state.currentBook = null;
      await loadBooks();
      if (state.books[0]) {
        const data = await api(`/api/books/${state.books[0].id}`);
        showBook(data.book);
      } else {
        showEmptyBook();
      }
      showMessage("这本书已经从书架移除。 ");
    } catch (error) {
      handleError(error, "无法移除这本书。");
    } finally {
      setBusy(false);
    }
  }

  function bindEvents() {
    refs.compileBookButton.addEventListener("click", () => void openCompileBookDialog());
    refs.emptyCompileBookButton.addEventListener("click", () => void openCompileBookDialog());
    refs.compileBookForm.addEventListener("submit", (event) => void compileBook(event));
    refs.cancelCompileBook.addEventListener("click", () => refs.compileBookDialog.close());
    refs.deleteBookButton.addEventListener("click", () => refs.deleteBookDialog.showModal());
    refs.confirmDeleteBook.addEventListener("click", () => void removeCurrentBook());
  }

  return Object.freeze({ bindEvents, open });
}
