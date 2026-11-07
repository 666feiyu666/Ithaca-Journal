export function localDayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayKeyOf(entry) {
  return localDayKey(entry?.created_at ?? entry?.updated_at ?? "");
}

function timestampOf(entry) {
  const time = new Date(entry?.created_at ?? entry?.updated_at ?? "").getTime();
  return Number.isNaN(time) ? 0 : time;
}

function dayLabel(dayKey, { now, locale }) {
  const today = localDayKey(now);
  const yesterday = localDayKey(new Date(now.getTime() - 86_400_000));
  if (dayKey === today) return locale === "en" ? "Today" : "今天";
  if (dayKey === yesterday) return locale === "en" ? "Yesterday" : "昨天";
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(year, month - 1, day);
  const sameYear = year === now.getFullYear();
  return new Intl.DateTimeFormat(locale === "en" ? "en" : "zh-CN", {
    ...(sameYear ? {} : { year: "numeric" }),
    month: "long",
    day: "numeric",
  }).format(date);
}

/**
 * Group pages by the writer's local calendar day of creation, newest day first.
 * Editing a page changes its last-edited label, never its position here.
 */
export function groupEntriesByCreationDay(entries, { now = new Date(), locale = "zh-CN" } = {}) {
  const groups = new Map();
  for (const entry of entries ?? []) {
    const key = dayKeyOf(entry);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, dayEntries]) => ({
      key,
      label: dayLabel(key, { now, locale }),
      entries: [...dayEntries].sort((left, right) => (
        timestampOf(right) - timestampOf(left) || String(right.id).localeCompare(String(left.id))
      )),
    }));
}

export function formatDayTime(value, locale = "zh-CN") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en" : "zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
