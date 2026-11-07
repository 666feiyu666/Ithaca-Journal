import test from "node:test";
import assert from "node:assert/strict";

import { groupEntriesByCreationDay, localDayKey } from "../../src/client/app/timeline.js";

const now = new Date(2026, 10, 7, 15, 30);
const at = (year, month, day, hour = 9) => new Date(year, month - 1, day, hour, 0).toISOString();

const pages = [
  { id: "today-early", created_at: at(2026, 11, 7, 8), updated_at: at(2026, 11, 7, 9) },
  { id: "today-late", created_at: at(2026, 11, 7, 14), updated_at: at(2026, 11, 7, 14) },
  { id: "yesterday", created_at: at(2026, 11, 6, 20), updated_at: at(2026, 11, 7, 12) },
  { id: "older", created_at: at(2026, 9, 2, 10), updated_at: at(2026, 9, 2, 10) },
];

test("pages group by local creation day, newest day first and newest page first", () => {
  const groups = groupEntriesByCreationDay(pages, { now, locale: "zh-CN" });

  assert.deepEqual(groups.map(({ key }) => key), ["2026-11-07", "2026-11-06", "2026-09-02"]);
  assert.deepEqual(groups.map(({ label }) => label), ["今天", "昨天", "9月2日"]);
  assert.deepEqual(groups[0].entries.map(({ id }) => id), ["today-late", "today-early"]);
});

test("editing a page changes its last-edited time but not its day or position", () => {
  const edited = pages.map((page) => (
    page.id === "older" ? { ...page, updated_at: at(2026, 11, 7, 16) } : page
  ));
  const groups = groupEntriesByCreationDay(edited, { now, locale: "zh-CN" });

  assert.deepEqual(groups.map(({ key }) => key), ["2026-11-07", "2026-11-06", "2026-09-02"]);
  assert.deepEqual(groups[2].entries.map(({ id }) => id), ["older"]);
});

test("day keys and labels follow the writer's local calendar", () => {
  assert.equal(localDayKey(new Date(2026, 0, 1, 23, 59)), "2026-01-01");
  assert.equal(localDayKey("2026-01-02T03:00:00.000Z") === "2026-01-01"
    || localDayKey("2026-01-02T03:00:00.000Z") === "2026-01-02", true);

  const english = groupEntriesByCreationDay(pages, { now, locale: "en" });
  assert.deepEqual(english.map(({ label }) => label), ["Today", "Yesterday", "September 2"]);
});

test("pages without a usable date are left out of the timeline", () => {
  const groups = groupEntriesByCreationDay([{ id: "broken", created_at: "not a date" }], { now });
  assert.deepEqual(groups, []);
});
