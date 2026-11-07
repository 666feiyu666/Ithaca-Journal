const DRAFT_VERSION = 1;
const DRAFT_KIND = "draft";
const DRAFT_STORAGE_PREFIX = "ithaca-journal:draft:v1:";
const MAX_TAGS = 20;

function storageKeyFor(user) {
  const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
  if (!email) return null;
  return `${DRAFT_STORAGE_PREFIX}${encodeURIComponent(email)}`;
}

function normalizeDraft(value) {
  if (!value || typeof value !== "object") return null;
  const body = typeof value.body === "string" ? value.body : null;
  if (body === null) return null;
  const title = typeof value.title === "string" ? value.title : "";
  const category = typeof value.category === "string" && value.category ? value.category : null;
  const recipient = typeof value.recipient === "string" ? value.recipient : "";
  const entryId = typeof value.entry_id === "string" && value.entry_id ? value.entry_id : null;
  const tags = Array.isArray(value.tags)
    ? [...new Set(value.tags.filter((tag) => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean))]
      .slice(0, MAX_TAGS)
    : [];
  if (!body.trim() && !title.trim() && tags.length === 0) return null;
  return {
    version: DRAFT_VERSION,
    entry_id: entryId,
    category,
    title,
    body,
    tags,
    recipient: category === "letter" ? recipient : "",
    saved_at: typeof value.saved_at === "string" ? value.saved_at : new Date().toISOString(),
  };
}

/**
 * Keeps one encrypted in-progress page per account in browser storage.
 * Content is sealed with the vault key before it is written, so storage never
 * sees plaintext body, title, tags, or recipient.
 */
export function createDraftStore({ vault, user, storage = globalThis.localStorage } = {}) {
  const key = storageKeyFor(user);

  function usableStorage() {
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
      return null;
    }
    return storage;
  }

  async function save(draft) {
    const store = usableStorage();
    const record = normalizeDraft(draft);
    if (!store || !key || !record) return null;
    if (!vault?.isUnlocked?.()) return null;
    const sealed = await vault.seal(DRAFT_KIND, key, record);
    store.setItem(key, JSON.stringify({ version: DRAFT_VERSION, sealed_payload: sealed }));
    return record;
  }

  async function load() {
    const store = usableStorage();
    if (!store || !key) return null;
    const raw = store.getItem(key);
    if (!raw) return null;
    try {
      const stored = JSON.parse(raw);
      if (stored?.version !== DRAFT_VERSION || !stored?.sealed_payload) throw new Error("invalid draft record");
      const record = normalizeDraft(await vault.open(DRAFT_KIND, key, stored.sealed_payload));
      if (!record) throw new Error("empty draft");
      return record;
    } catch {
      clear();
      return null;
    }
  }

  function clear() {
    const store = usableStorage();
    if (!store || !key) return;
    if (typeof store.removeItem === "function") store.removeItem(key);
    else store.setItem(key, "");
  }

  return Object.freeze({ clear, key, load, save });
}
