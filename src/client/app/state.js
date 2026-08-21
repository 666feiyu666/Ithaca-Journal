export function createAppState() {
  return {
    user: null,
    journey: null,
    entries: [],
    entriesLoaded: false,
    topics: [],
    topicsLoaded: false,
    books: [],
    booksLoaded: false,
    letters: [],
    current: null,
    currentTopic: null,
    currentBook: null,
    workbenchMode: "fragments",
    dirty: false,
    busy: false,
    messageTimer: null,
  };
}
