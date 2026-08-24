import { formatDate } from "./format.js";

const MAX_SEALED_BOOK_BYTES = 1_100_000;

export function createLibraryFeature({
  state,
  refs,
  api,
  vault,
  setBusy,
  showBooksView,
  openDesk,
  showMessage,
  handleError,
  canLeaveCurrentDraft,
  onBound = () => {},
}) {
  function renderBookList() {
    refs.bookList.replaceChildren();
    refs.bookListEmpty.hidden = state.books.length !== 0;
    for (const book of state.books) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "book-list__item book-cover";
      item.setAttribute("role", "listitem");
      item.setAttribute("aria-current", String(state.currentBook?.id === book.id));
      const ornament = document.createElement("span");
      ornament.className = "book-cover__ornament";
      ornament.setAttribute("aria-hidden", "true");
      ornament.textContent = "IJ";
      const title = document.createElement("strong");
      title.dataset.i18nSkip = "";
      title.textContent = book.title;
      const date = document.createElement("small");
      date.textContent = formatDate(book.created_at);
      item.append(ornament, title, date);
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
    state.books = await Promise.all(data.books.map((book) => vault.openBook(book)));
    state.booksLoaded = true;
    renderBookList();
  }

  async function openBook(bookId) {
    if (state.busy) return;
    setBusy(true);
    try {
      const data = await api(`/api/books/${bookId}`);
      showBook(await vault.openBook(data.book));
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
      if (!state.booksLoaded) await loadBooks();
      if (state.currentBook?.id) showBook(state.currentBook);
      else if (state.books[0]) {
        const data = await api(`/api/books/${state.books[0].id}`);
        showBook(await vault.openBook(data.book));
      } else showEmptyBook();
    } catch (error) {
      handleError(error, "无法读取书架。");
      showEmptyBook();
    } finally {
      setBusy(false);
    }
  }

  async function startBook() {
    await openDesk({
      category: "book",
      draft: { title: "", body: "", tags: [] },
    });
  }

  async function bindDraft(entry) {
    if (!entry?.id || entry.category !== "book" || state.busy) return;
    const contentSnapshot = [`# ${entry.title}`, entry.body].filter(Boolean).join("\n\n");
    const bookContent = {
      title: entry.title,
      preface: "",
      content_snapshot: contentSnapshot,
      sources: [],
    };
    if (new TextEncoder().encode(JSON.stringify(bookContent)).byteLength > MAX_SEALED_BOOK_BYTES) {
      showMessage("这份书稿超过当前版本的加密装订大小限制。", "error");
      return;
    }
    setBusy(true);
    let createdBookId = null;
    try {
      const id = crypto.randomUUID();
      const sealedPayload = await vault.seal("book", id, bookContent);
      const data = await api("/api/books", {
        method: "POST",
        body: JSON.stringify({ id, source_entry_id: entry.id, sealed_payload: sealedPayload }),
      });
      const book = await vault.openBook(data.book);
      createdBookId = book.id;
      state.booksLoaded = false;
      showMessage("书稿已经装订，并作为独立快照放上书架。");
    } catch (error) {
      handleError(error, "无法装订这份书稿。");
    } finally {
      setBusy(false);
    }
    if (createdBookId) {
      await open();
      await openBook(createdBookId);
      onBound(state.currentBook);
    }
  }

  async function removeCurrentBook() {
    if (!state.currentBook?.id || state.busy) return;
    setBusy(true);
    try {
      await api(`/api/books/${state.currentBook.id}`, { method: "DELETE" });
      state.currentBook = null;
      await loadBooks();
      if (state.books[0]) {
        const data = await api(`/api/books/${state.books[0].id}`);
        showBook(await vault.openBook(data.book));
      } else showEmptyBook();
      showMessage("这本书已经从书架移除，原书稿仍留在书桌。");
    } catch (error) {
      handleError(error, "无法移除这本书。");
    } finally {
      setBusy(false);
    }
  }

  function bindEvents() {
    refs.compileBookButton.addEventListener("click", () => void startBook());
    refs.emptyCompileBookButton.addEventListener("click", () => void startBook());
    refs.deleteBookButton.addEventListener("click", () => refs.deleteBookDialog.showModal());
    refs.confirmDeleteBook.addEventListener("click", () => void removeCurrentBook());
  }

  return Object.freeze({ bindDraft, bindEvents, open, startBook });
}
